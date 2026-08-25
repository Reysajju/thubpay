import NextAuth, { type NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

// ─── Auth Configuration ───────────────────────────────────────
// Bulletproof credentials provider with self-healing demo accounts
// and resilient database / in-memory fallback.

// Refuse to start in production without a real NEXTAUTH_SECRET. The previous
// fallback ('thubpay-super-secret-change-me-in-production-2024') is a publicly-
// known constant — anyone could forge JWTs against any deployment that
// accidentally shipped without the env var set.
const RAW_AUTH_SECRET = process.env.NEXTAUTH_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD && (!RAW_AUTH_SECRET || RAW_AUTH_SECRET.length < 32)) {
  // Hard-fail at module-load — better than a silent insecure runtime.
  throw new Error(
    '[auth] FATAL: NEXTAUTH_SECRET must be set to a strong (>= 32 char) value in production.'
  );
}
const AUTH_SECRET =
  RAW_AUTH_SECRET || 'thubpay-dev-only-secret-not-for-production-2024-local';

// Demo accounts are explicitly disabled in production so the seeded admin
// credentials can never be used to log into a real deployment. (C9 fix.)
const DEMO_ACCOUNTS: Record<string, { pass: string; name: string; role: string }> =
  IS_PROD
    ? {}
    : {
        'admin@thubpay.com': { pass: 'admin123', name: 'ThubPay Admin', role: 'owner' },
        'demo@thubpay.com': { pass: 'demo123', name: 'Demo User', role: 'owner' },
      };

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString();

        if (!email || !password) {
          throw new Error('Email and password are required');
        }

        // ─── 1. Check Demo Accounts (Guaranteed to work seamlessly) ────
        const demoConfig = DEMO_ACCOUNTS[email];
        if (demoConfig && password === demoConfig.pass) {
          try {
            // Attempt to resolve or auto-seed the demo user in the database
            let user = await db.appUser.findUnique({
              where: { email },
              include: {
                workspaces: {
                  include: { workspace: true },
                  orderBy: { createdAt: 'asc' },
                  take: 1,
                },
              },
            });

            if (!user) {
              const passwordHash = await bcrypt.hash(password, 10);
              user = await db.appUser.create({
                data: {
                  email,
                  name: demoConfig.name,
                  passwordHash,
                  role: demoConfig.role,
                },
                include: {
                  workspaces: {
                    include: { workspace: true },
                    orderBy: { createdAt: 'asc' },
                    take: 1,
                  },
                },
              });
            }

            let workspaceId = user.workspaces[0]?.workspaceId;
            if (!workspaceId) {
              const ws = await db.workspace.create({
                data: {
                  name: `${demoConfig.name}'s Workspace`,
                  slug: `workspace-${user.id.slice(-6)}`,
                  ownerUserId: user.id,
                  plan: 'pro',
                  baseCurrency: 'USD',
                  monthlyTargetCents: 500000,
                  onboardingCompleted: true,
                  members: {
                    create: { userId: user.id, role: 'owner' },
                  },
                },
              });
              workspaceId = ws.id;
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name || demoConfig.name,
              role: demoConfig.role,
              workspaceId: workspaceId || 'ws-demo-workspace',
              isDemo: true,
            } as any;
          } catch (dbErr) {
            console.warn('[auth] Database offline or uninitialized during demo login. Using resilient demo session:', dbErr);
            return {
              id: 'demo-admin-id',
              email,
              name: demoConfig.name,
              role: demoConfig.role,
              workspaceId: 'ws-demo-workspace',
              isDemo: true,
            } as any;
          }
        }

        // ─── 2. Standard User Database Authentication ─────────────
        try {
          const user = await db.appUser.findUnique({
            where: { email },
            include: {
              workspaces: {
                include: { workspace: true },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
            },
          });

          if (!user) {
            throw new Error('Invalid email or password');
          }

          const passwordValid = await bcrypt.compare(password, user.passwordHash);
          if (!passwordValid) {
            throw new Error('Invalid email or password');
          }

          const primaryMembership = user.workspaces[0];
          const workspaceId = primaryMembership?.workspaceId || 'ws-demo-workspace';
          const role = primaryMembership?.role || user.role || 'owner';

          return {
            id: user.id,
            email: user.email,
            name: user.name || user.email.split('@')[0],
            role,
            workspaceId,
            isDemo: false,
          } as any;
        } catch (err: any) {
          if (err.message && err.message.includes('Invalid email or password')) {
            throw err;
          }
          console.error('[auth] Database authentication error:', err);
          throw new Error('Authentication service temporarily unavailable. Please try again.');
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role || 'owner';
        token.workspaceId = (user as any).workspaceId || 'ws-demo-workspace';
        token.isDemo = (user as any).isDemo || false;

        // ── Audit log entry for login ──
        // Real (non-demo) users get `login.success`; demo users get
        // `demo.login` so demo usage is tracked separately.
        const wsId = (user as any).workspaceId;
        const isDemoUser =
          (user as any).isDemo || String((user as any).id).startsWith('demo-');
        if (wsId && wsId !== 'ws-demo-workspace') {
          db.auditLog.create({
            data: {
              workspaceId: wsId,
              userId: isDemoUser ? null : (user as any).id,
              action: isDemoUser ? 'demo.login' : 'login.success',
              entity: 'user',
              entityId: (user as any).id,
              metadata: JSON.stringify({
                email: (user as any).email,
                name: (user as any).name,
                role: (user as any).role,
                isDemo: isDemoUser,
              }),
            },
          }).catch(() => {
            /* non-fatal — audit log is best-effort */
          });
        }
      }

      if (trigger === 'update' && session) {
        if (session.workspaceId) token.workspaceId = session.workspaceId;
        if (session.role) token.role = session.role;
      }

      // Re-validate non-demo users if database is available
      if (token.id && !token.isDemo && !String(token.id).startsWith('demo-')) {
        try {
          const stillValid = await db.appUser.findUnique({
            where: { id: token.id as string },
            select: { id: true },
          });
          if (!stillValid) {
            return { ...token, id: undefined, email: undefined, sub: undefined } as any;
          }
        } catch {
          // If DB is temporarily unavailable, preserve the session
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id || 'demo-admin-id';
        (session.user as any).role = token.role || 'owner';
        (session.user as any).workspaceId = token.workspaceId || 'ws-demo-workspace';
        (session.user as any).isDemo = token.isDemo || false;
      }
      return session;
    },
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,   // refresh token daily
  },
  secret: AUTH_SECRET,
  debug: false,
};

// V4 App Router handler
const handler = NextAuth(authOptions);
export default handler;

// ─── Server-side session helper ───────────────────────────────
import { getServerSession } from 'next-auth';

export async function auth() {
  return await getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    user: {
      id: (session.user as any).id || 'unknown',
      email: session.user.email || '',
      name: session.user.name || '',
      role: (session.user as any).role || 'owner',
      workspaceId: (session.user as any).workspaceId || 'ws-demo-workspace',
    },
    session,
  };
}

// ─── Sign-up helper ───────────────────────────────────────────
export { registerUser } from '@/lib/register';
