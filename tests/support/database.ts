import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../../src/server/db';
export function testDatabase() {
  const dir = mkdtempSync(join(tmpdir(), 'family-test-'));
  const url = 'file:' + join(dir, 'test.db');
  const db = createDatabase(url);
  return {
    db,
    url,
    async init() {
      for (const migration of readdirSync('prisma/migrations')
        .filter((x) => /^\d/.test(x))
        .sort()) {
        const sql = readFileSync(join('prisma/migrations', migration, 'migration.sql'), 'utf8');
        for (const stmt of sql
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean))
          await db.$executeRawUnsafe(stmt);
      }
    },
    async close() {
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
