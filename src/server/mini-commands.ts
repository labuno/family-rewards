import { z } from 'zod';
import type { Database } from './db';
import type { Actor } from './permissions';
import { Accounts } from './accounts';
import { RecordTypes } from './record-types';
import { Family } from '../services/family';
import { SHOUT_TARGETS } from '../domain/rules';

const text = z.string().trim().min(1);
const key = z.string().min(1).max(100);
const record = z.object({
  subjectId: text,
  type: text,
  occurredAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  quantity: z.number().int().min(1).max(1000),
  reason: text.max(1000),
  source: text.max(200).optional(),
  requestKey: key,
  evidence: z
    .object({
      grade: z.enum(['A+', 'A', 'B', 'C']).optional(),
      score: z.number().min(0).max(100).optional(),
      schoolYear: z.string().trim().max(30).optional(),
      shoutTarget: z.enum(SHOUT_TARGETS).optional(),
    })
    .default({}),
});
export async function miniCommand(db: Database, actor: Actor, input: Record<string, unknown>) {
  const family = new Family(db);
  switch (input.action) {
    case 'setup':
      return new Accounts(db).setup(actor, text.parse(input.anchor));
    case 'create-type':
      return new RecordTypes(db).create(
        actor,
        z
          .object({ name: text.max(60), money: z.number().int(), points: z.number().int() })
          .parse(input),
      );
    case 'record': {
      const data = record.parse(input);
      if (data.type === 'SHOUT') z.enum(SHOUT_TARGETS).parse(data.evidence.shoutTarget);
      return family.record(actor, {
        ...data,
        source: data.source ?? data.requestKey,
        evidence: JSON.stringify(data.evidence),
      });
    }
    case 'decide': {
      const data = z
        .object({
          eventId: text,
          decision: z.enum(['CONFIRM', 'DISPUTE']),
          requestKey: key,
          reason: z.string().max(1000).default(''),
        })
        .parse(input);
      await family.decide(actor, data.eventId, data.decision, data.requestKey, data.reason);
      return { ok: true };
    }
    case 'delete-event':
      await family.remove(actor, text.parse(input.eventId));
      return { ok: true };
    case 'reverse': {
      const data = z
        .object({ eventId: text, reason: text.max(1000), requestKey: key })
        .parse(input);
      return family.reverse(actor, data.eventId, data.reason, data.requestKey);
    }
    case 'generate':
      return family.generate(actor, text.parse(input.subjectId), text.parse(input.start));
    case 'confirm-summary':
      await family.confirmSummary(actor, text.parse(input.id));
      return { ok: true };
    case 'post':
      return family.post(actor, text.parse(input.id));
    default:
      throw new Error('不支持的操作');
  }
}
