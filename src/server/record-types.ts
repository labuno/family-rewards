import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database } from './db';
import { requireAdmin, type Actor } from './permissions';
import { DEFAULT_RULES } from '../domain/rules';
import { audit, type Connection } from '../services/state';
const schema = z.object({
  name: z.string().trim().min(1).max(60),
  money: z.number().int().min(-1000000000).max(1000000000),
  points: z.number().int().min(-1000000).max(1000000),
});
export const hashRules = (rules: unknown) =>
  createHash('sha256').update(JSON.stringify(rules)).digest('hex');
export async function currentRules(db: Connection) {
  const types = await db.recordType.findMany({ orderBy: { code: 'asc' } });
  const custom = Object.fromEntries(
    types.map((t) => [t.code, { name: t.name, money: t.money, points: t.points }]),
  );
  const rules = { ...DEFAULT_RULES, custom };
  return { rules, key: hashRules(rules), types };
}
export class RecordTypes {
  constructor(private db: Database) {}
  list() {
    return this.db.recordType.findMany({ orderBy: { createdAt: 'asc' } });
  }
  async create(actor: Actor, input: z.input<typeof schema>) {
    requireAdmin(actor);
    const data = schema.parse(input);
    return this.db.$transaction(async (tx) => {
      const record = await tx.recordType.create({
        data: {
          ...data,
          code: 'CUSTOM_' + randomUUID().replaceAll('-', '').toUpperCase(),
          actorId: actor.id,
        },
      });
      await audit(tx, actor.id, 'RECORD_TYPE_CREATED', record.id, { ...data, code: record.code });
      return record;
    });
  }
}
