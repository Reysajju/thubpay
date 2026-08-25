import { cache } from 'react';
import { getServerSession, type Session } from 'next-auth';

// ─── Lightweight Session Helper ───────────────────────────────
// This file provides a minimal `auth()` function that only imports
// `getServerSession` from next-auth — it does NOT import the Prisma
// client, bcrypt, or the full authOptions. This prevents Turbopack
// from pulling in the entire auth + db chain when a layout or page
// just needs to check if a user is logged in.
//
// The full authOptions (with Prisma + bcrypt) are only imported by
// the NextAuth route handler at `/api/auth/[...nextauth]/route.ts`.

// Lazy-load authOptions only when needed
let _authOptions: any = null;
async function getAuthOptions() {
  if (!_authOptions) {
    const { authOptions } = await import('@/lib/auth');
    _authOptions = authOptions;
  }
  return _authOptions;
}

export const auth = cache(async (): Promise<Session | null> => {
  const authOptions = await getAuthOptions();
  return await getServerSession(authOptions);
});

export const getSessionUserId = cache(async (): Promise<string | null> => {
  const session = await auth();
  return (session?.user as any)?.id || null;
});

export async function getSessionUser(): Promise<{
  id: string;
  email: string;
  name: string;
  role: string;
  workspaceId: string | null;
} | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: (session.user as any).id || 'unknown',
    email: session.user.email || '',
    name: session.user.name || '',
    role: (session.user as any).role || 'owner',
    workspaceId: (session.user as any).workspaceId || null,
  };
}
