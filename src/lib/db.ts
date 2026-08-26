import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// L7 fix: enable Prisma query logging in dev (helps debug N+1 / hot paths),
// keep only `error` + `warn` in production to avoid leaking query text.
// Note: use `as const` on the production branch too so the array's type
// narrows to `(LogLevel | LogDefinition)[]` rather than `string[]`.
const logLevel: Array<'query' | 'error' | 'warn'> =
  process.env.NODE_ENV === 'production'
    ? ['error', 'warn']
    : process.env.DEBUG_PRISMALOG
      ? ['query', 'error', 'warn']
      : ['error', 'warn'];

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ log: logLevel });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
