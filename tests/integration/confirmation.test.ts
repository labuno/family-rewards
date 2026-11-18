import { beforeAll, afterAll, expect, it } from 'vitest';
import { testDatabase } from '../support/database';
import { Accounts } from '../../src/server/accounts';
import { Family } from '../../src/services/family';
import type { Actor } from '../../src/server/permissions';
const f = testDatabase();
let dad: Actor, mom: Actor, ellie: Actor, other: Actor, family: Family;
const key = () => crypto.randomUUID();
const input = () => ({
  subjectId: ellie.id,
  type: 'DICTATION',
  occurredAt: new Date('2026-09-20T12:00:00+08:00'),
  quantity: 1,
  reason: '确认规则验证',
  source: key(),
  evidence: '{}',
  requestKey: key(),
});
beforeAll(async () => {
  await f.init();
  const a = new Accounts(f.db);
  dad = await a.create('dad', '爸爸', 'ADMIN', 'test-password-123', 0, 0);
  mom = await a.create('mom', '妈妈', 'ADMIN', 'test-password-123', 0, 0);
  ellie = await a.create('ellie', 'Ellie', 'USER', 'test-password-123', 0, 0);
  other = await a.create('other', '其他孩子', 'USER', 'test-password-123', 0, 0);
  await a.setup(dad, '2026-09-18');
  family = new Family(f.db, () => new Date('2026-11-20T12:00:00+08:00'));
});
afterAll(() => f.close());
it('爸爸创建，用户确认即可；保留创建时间，既有无确认行记录也支持', async () => {
  const event = await family.record(dad, input());
  expect(await f.db.eventDecision.count({ where: { eventId: event.id } })).toBe(0);
  await family.decide(mom, event.id, 'CONFIRM', key());
  expect((await family.history(dad, ellie.id))[0].status).toBe('PENDING');
  await family.decide(ellie, event.id, 'CONFIRM', key());
  expect((await family.history(dad, ellie.id))[0]).toMatchObject({
    status: 'CONFIRMED',
    confirmedBy: expect.arrayContaining(['爸爸', 'Ellie']),
    createdAt: event.createdAt,
  });
});
it('用户创建，妈妈确认即可，其他用户不能确认或代替', async () => {
  const event = await family.record(ellie, input());
  await expect(family.decide(other, event.id, 'CONFIRM', key())).rejects.toThrow('没有权限');
  await family.decide(mom, event.id, 'CONFIRM', key());
  expect((await family.history(dad, ellie.id)).find((e) => e.id === event.id)?.status).toBe(
    'CONFIRMED',
  );
  expect((await f.db.wallet.findUniqueOrThrow({ where: { subjectId: ellie.id } })).points).toBe(0);
});
it('反向记录也只等另一方，异议不能被另一管理员确认绕过', async () => {
  const event = await family.record(dad, input());
  await family.decide(dad, event.id, 'DISPUTE', key(), '需要核对');
  await family.decide(ellie, event.id, 'CONFIRM', key());
  await family.decide(mom, event.id, 'CONFIRM', key());
  expect((await family.history(dad, ellie.id)).find((e) => e.id === event.id)?.status).toBe(
    'DISPUTED',
  );
  await expect(family.generate(mom, ellie.id, '2026-09-18')).rejects.toThrow('异议');
  await family.decide(dad, event.id, 'CONFIRM', key());
  const reversal = await family.reverse(ellie, event.id, '反向测试', key());
  await family.decide(mom, reversal.id, 'CONFIRM', key());
  expect((await family.history(dad, ellie.id)).find((e) => e.id === event.id)?.status).toBe(
    'REVERSED',
  );
});
it('爸爸生成总结只等本人；妈妈无需再次确认即可入账，重复提交不重复入账', async () => {
  const summary = await family.generate(dad, ellie.id, '2026-09-18');
  await expect(family.post(mom, summary.id)).rejects.toThrow('确认');
  await expect(family.confirmSummary(other, summary.id)).rejects.toThrow('没有权限');
  await family.confirmSummary(ellie, summary.id);
  await family.confirmSummary(ellie, summary.id);
  expect(await f.db.settlementDecision.count({ where: { settlementId: summary.id } })).toBe(1);
  await family.post(mom, summary.id);
  await family.post(dad, summary.id);
  expect(await f.db.walletEntry.count({ where: { settlementId: summary.id } })).toBe(2);
  expect(await f.db.wallet.findUnique({ where: { subjectId: ellie.id } })).toMatchObject({
    money: 50000,
    points: 2,
  });
});
it('旧版未入账总结不含角色字段时，也按创建人加本人确认且不覆盖快照', async () => {
  const { summaryConfirmation } = await import('../../src/services/summary');
  const snapshot = JSON.stringify({
    participants: [
      { id: dad.id, name: '爸爸' },
      { id: mom.id, name: '妈妈' },
      { id: ellie.id, name: 'Ellie' },
    ],
  });
  const old = { subjectId: ellie.id, actorId: dad.id, snapshot };
  expect(summaryConfirmation(old, []).status).toBe('PENDING');
  expect(summaryConfirmation(old, [{ actorId: ellie.id }]).status).toBe('CONFIRMED');
  expect(old.snapshot).toBe(snapshot);
});

it('重复确认和创建人重复确认无副作用，不追加意见、审计或修订', async () => {
  const event = await family.record(dad, {
    ...input(),
    occurredAt: new Date('2026-10-20T12:00:00+08:00'),
  });
  const before = await f.db.user.findUniqueOrThrow({ where: { id: ellie.id } });
  await family.decide(dad, event.id, 'CONFIRM', key());
  await family.decide(dad, event.id, 'CONFIRM', key());
  expect(await f.db.eventDecision.count({ where: { eventId: event.id } })).toBe(0);
  expect((await f.db.user.findUniqueOrThrow({ where: { id: ellie.id } })).revision).toBe(
    before.revision,
  );
  const requestKey = key();
  await family.decide(ellie, event.id, 'CONFIRM', requestKey);
  const confirmed = await f.db.user.findUniqueOrThrow({ where: { id: ellie.id } });
  await family.decide(ellie, event.id, 'CONFIRM', requestKey);
  const results = await Promise.allSettled([
    family.decide(ellie, event.id, 'CONFIRM', key()),
    family.decide(ellie, event.id, 'CONFIRM', key()),
  ]);
  expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  expect(await f.db.eventDecision.count({ where: { eventId: event.id } })).toBe(1);
  expect(await f.db.audit.count({ where: { objectId: event.id, action: 'EVENT_CONFIRM' } })).toBe(
    1,
  );
  expect((await f.db.user.findUniqueOrThrow({ where: { id: ellie.id } })).revision).toBe(
    confirmed.revision,
  );
});
it('沟通记录在确认后保留，确认完成后所有成员都不能再发起异议', async () => {
  const event = await family.record(dad, {
    ...input(),
    occurredAt: new Date('2026-10-21T12:00:00+08:00'),
  });
  await family.decide(ellie, event.id, 'DISPUTE', key(), '试卷分数需要重新核对');
  await family.decide(ellie, event.id, 'CONFIRM', key());
  const history = (await family.history(dad, ellie.id)).find((e) => e.id === event.id)!;
  expect(history.status).toBe('CONFIRMED');
  expect(history.decisions).toContainEqual(
    expect.objectContaining({ name: 'Ellie', decision: 'DISPUTE', reason: '试卷分数需要重新核对' }),
  );
  const before = await f.db.user.findUniqueOrThrow({ where: { id: ellie.id } });
  const auditCount = await f.db.audit.count({ where: { objectId: event.id } });
  for (const actor of [dad, mom, ellie])
    await expect(family.decide(actor, event.id, 'DISPUTE', key(), '再次沟通')).rejects.toThrow(
      '已确认',
    );
  expect(await f.db.eventDecision.count({ where: { eventId: event.id } })).toBe(2);
  expect(await f.db.audit.count({ where: { objectId: event.id } })).toBe(auditCount);
  expect((await f.db.user.findUniqueOrThrow({ where: { id: ellie.id } })).revision).toBe(
    before.revision,
  );
  const reversal = await family.reverse(dad, event.id, '实际内容错误需反向更正', key());
  await family.decide(ellie, reversal.id, 'CONFIRM', key());
  expect((await family.history(dad, ellie.id)).find((e) => e.id === event.id)?.status).toBe(
    'REVERSED',
  );
  await expect(family.decide(mom, event.id, 'DISPUTE', key(), '再谈谈')).rejects.toThrow('已确认');
});
