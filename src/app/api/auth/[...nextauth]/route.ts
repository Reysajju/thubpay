import handler from '@/lib/auth';
import { type NextRequest } from 'next/server';

async function authRoute(req: NextRequest, ctx: any) {
  try {
    const params = ctx?.params ? await ctx.params : undefined;
    return await handler(req, { params: params ?? { nextauth: req.nextUrl.pathname.replace(/^\/api\/auth\/?/, '').split('/').filter(Boolean) } });
  } catch (err) {
    // C8 fix: never leak the raw error to the client. String(err) on a Prisma
    // error can include the connection string or SQL fragments — return a
    // generic message to the client while logging the full error server-side.
    console.error('[NextAuth Route Handler Error]:', err);
    return new Response(
      JSON.stringify({ error: 'Internal authentication error. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export { authRoute as GET, authRoute as POST };

