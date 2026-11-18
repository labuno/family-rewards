import { beforeEach, afterEach, expect, it } from 'vitest';
import { testDatabase } from '../support/database';
import { Accounts } from '../../src/server/accounts';
import { Family } from '../../src/services/family';
import type { Actor } from '../../src/server/permissions';
let f: ReturnType<typeof testDatabase>, family: Family, dad: Actor, mom: Actor, child: Actor;
const key = () => crypto.randomUUID();
const input = () => ({
  subjectId: child.id,
  type: 'DICTATION',
  occurredAt: new Date('2026-09-20T12:00:00+08:00'),
  quantity: 1,
  reason: '删除规则验证',
  source: key(),
  evidence: '{}',
  requestKey: key(),
});
beforeEach(async () => {
  f = testDatabase();
  await f.init();
  const a = new Accounts(f.db);
  dad = await a.create('dad', '爸爸', 'ADMIN', 'test-password-123', 0, 0);
  mom = await a.create('mom', '妈妈', 'ADMIN', 'test-password-123', 0, 0);
  child = await a.create('child', '孩子', 'USER', 'test-password-123', 0, 0);
  await a.setup(dad, '2026-09-18');
  family = new Family(f.db, () => new Date('2026-11-20T12:00:00+08:00'));
});
afterEach(() => f.close());
it('仅创建人可删除无人确认的记录，重复删除幂等，列表与结算排除，钱包不变', async () => {
  const event = await family.record(dad, input());
  await expect(family.remove(mom, event.id)).rejects.toThrow('创建人');
  await expect(family.remove(child, event.id)).rejects.toThrow('创建人');
  const before = await f.db.user.findUniqueOrThrow({ where: { id: child.id } });
  await family.remove(dad, event.id);
  await family.remove(dad, event.id);
  expect(await f.db.event.findUnique({ where: { id: event.id } })).toMatchObject({
    deletedAt: expect.any(Date),
    deletedBy: dad.id,
  });
  expect(await family.history(dad, child.id)).toHaveLength(0);
  expect(await f.db.audit.count({ where: { action: 'EVENT_DELETED', objectId: event.id } })).toBe(
    1,
  );
  expect((await f.db.user.findUniqueOrThrow({ where: { id: child.id } })).revision).toBe(
    before.revision + 1,
  );
  const summary = await family.generate(dad, child.id, '2026-09-18');
  expect(JSON.parse(summary.snapshot).eventIds).toEqual([]);
  expect(await f.db.wallet.findUnique({ where: { subjectId: child.id } })).toMatchObject({
    money: 0,
    points: 0,
  });
});
it('孩子创建也能在他人确认前删除，创建人自己的确认不阻止删除', async () => {
  const event = await family.record(child, input());
  await family.decide(child, event.id, 'CONFIRM', key());
  await family.remove(child, event.id);
  expect(await family.history(child, child.id)).toHaveLength(0);
});
it('任意其他人确认后不能删除，即使双方尚未齐全', async () => {
  const event = await family.record(dad, input());
  await family.decide(mom, event.id, 'CONFIRM', key());
  await expect(family.remove(dad, event.id)).rejects.toThrow('已有其他成员确认');
  expect((await family.history(dad, child.id))[0].status).toBe('PENDING');
});
it('删除后不可确认或反向，来源可重新录入；旧提交不能复活删除记录', async () => {
  const data = input(),
    event = await family.record(dad, data);
  await family.remove(dad, event.id);
  await expect(family.decide(child, event.id, 'CONFIRM', key())).rejects.toThrow('已删除');
  await expect(family.reverse(dad, event.id, '更正', key())).rejects.toThrow('已删除');
  await expect(family.record(dad, data)).rejects.toThrow('已删除');
  const replacement = await family.record(dad, { ...data, requestKey: key() });
  expect(replacement.id).not.toBe(event.id);
});
it('先删除未确认反向记录，原记录才能删除；反向删除不占用可更正次数', async () => {
  const event = await family.record(dad, input());
  const reverse = await family.reverse(dad, event.id, '错误录入', key());
  await expect(family.remove(dad, event.id)).rejects.toThrow('反向记录');
  await family.remove(dad, reverse.id);
  const next = await family.reverse(dad, event.id, '重新更正', key());
  await family.remove(dad, next.id);
  await family.remove(dad, event.id);
  expect(await family.history(dad, child.id)).toHaveLength(0);
});
it('确认与删除并发只能一方生效，不能留下已确认却被删除的记录', async () => {
  const event = await family.record(dad, input());
  const results = await Promise.allSettled([
    family.decide(child, event.id, 'CONFIRM', key()),
    family.remove(dad, event.id),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const stored = await f.db.event.findUniqueOrThrow({ where: { id: event.id } });
  const approvals = await f.db.eventDecision.count({
    where: { eventId: event.id, actorId: child.id, decision: 'CONFIRM' },
  });
  expect(stored.deletedAt ? approvals === 0 : approvals === 1).toBe(true);
});
it('已结算记录不能删除；不存在的记录明确失败', async () => {
  const event = await family.record(dad, input());
  await family.decide(child, event.id, 'CONFIRM', key());
  const summary = await family.generate(dad, child.id, '2026-09-18');
  await family.confirmSummary(child, summary.id);
  await family.post(dad, summary.id);
  await expect(family.remove(dad, event.id)).rejects.toThrow();
  await expect(family.remove(dad, 'missing')).rejects.toThrow();
});
it('删除审计写入失败时，删除标记和修订号同时回滚', async () => {
  const event = await family.record(dad, input());
  const before = await f.db.user.findUniqueOrThrow({ where: { id: child.id } });
  await f.db.$executeRawUnsafe(
    "CREATE TRIGGER fail_delete_audit BEFORE INSERT ON Audit WHEN NEW.action='EVENT_DELETED' BEGIN SELECT RAISE(ABORT,'test delete failure'); END",
  );
  await expect(family.remove(dad, event.id)).rejects.toThrow();
  expect((await f.db.event.findUniqueOrThrow({ where: { id: event.id } })).deletedAt).toBeNull();
  expect((await f.db.user.findUniqueOrThrow({ where: { id: child.id } })).revision).toBe(
    before.revision,
  );
  expect(await family.history(dad, child.id)).toHaveLength(1);
});
it('删除标记迁移保留旧版已有记录，新增字段默认为空', async () => {
  const { readFileSync } = await import('node:fs');
  const old = testDatabase();
  try {
    for (const file of ['202610200001_initial', '202610200002_record_types']) {
      for (const sql of readFileSync('prisma/migrations/' + file + '/migration.sql', 'utf8')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await old.db.$executeRawUnsafe(sql);
    }
    await old.db
      .$executeRaw`INSERT INTO Event (id,subjectId,periodStart,type,occurredAt,quantity,reason,evidence,source,actorId,requestKey) VALUES ('old-event','old-child','2026-09-18','DICTATION',${new Date('2026-09-20T12:00:00+08:00')},1,'迁移前真实结构记录','{}','old-source','old-dad','old-key')`;
    for (const sql of readFileSync(
      'prisma/migrations/202610200003_event_deletion/migration.sql',
      'utf8',
    )
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await old.db.$executeRawUnsafe(sql);
    expect(await old.db.event.findUnique({ where: { id: 'old-event' } })).toMatchObject({
      reason: '迁移前真实结构记录',
      deletedAt: null,
      deletedBy: null,
    });
    expect(await old.db.event.count()).toBe(1);
  } finally {
    await old.close();
  }
});
