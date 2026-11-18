import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export function createDatabase(url: string) {
  if (!url.startsWith('file:')) throw new Error('仅支持本地 SQLite 数据库');
  mkdirSync(dirname(resolve(url.slice(5))), { recursive: true, mode: 0o700 });
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
const globalDb = globalThis as unknown as { familyDb?: PrismaClient };
export function database() {
  return (
    globalDb.familyDb ??
    (globalDb.familyDb = createDatabase(process.env.DATABASE_URL ?? 'file:./data/family.db'))
  );
}
export type Database = PrismaClient;
