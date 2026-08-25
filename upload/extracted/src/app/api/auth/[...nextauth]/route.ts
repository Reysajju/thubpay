import handler from '@/lib/auth';
import { type NextRequest } from 'next/server';

async function authRoute(req: NextRequest, ctx: any) {
  try {
    const params = ctx?.params ? await ctx.params : undefined;
    return await handler(req, { params: params ?? { nextauth: req.nextUrl.pathname.replace(/^\/api\/auth\/?/, '').split('/').filter(Boolean) } });
  } catch (err) {
    console.error('[NextAuth Route Handler Error]:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export { authRoute as GET, authRoute as POST };

