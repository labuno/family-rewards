import { beforeAll, afterAll, expect, it } from 'vitest';
import { testDatabase } from '../support/database';
import { Accounts } from '../../src/server/accounts';
import { RecordTypes } from '../../src/server/record-types';
import { Family } from '../../src/services/family';
import type { Actor } from '../../src/server/permissions';
const f = testDatabase();
let dad: Actor, mom: Actor, child: Actor, types: RecordTypes, family: Family;
beforeAll(async () => {
  await f.init();
  const a = new Accounts(f.db);
  dad = await a.create('dad', '爸爸', 'ADMIN', 'a-test-password-123', 0, 0);
  mom = await a.create('mom', '妈妈', 'ADMIN', 'a-test-password-123', 0, 0);
  child = await a.create('child', '孩子', 'USER', 'a-test-password-123', 0, 0);
  await a.setup(dad, '2026-09-18');
  types = new RecordTypes(f.db);
  family = new Family(f.db, () => new Date('2026-11-20T12:00:00+08:00'));
});
afterAll(() => f.close());
it('管理员新增类型，普通用户只读，重复名称及非法金额不写入', async () => {
  await expect(types.create(child, { name: '补录奖励', money: 10000, points: 2 })).rejects.toThrow(
    '仅管理员',
  );
  const type = await types.create(dad, { name: '补录奖励', money: 10000, points: 2 });
  expect(type.code).toMatch(/^CUSTOM_/);
  expect(await types.list()).toContainEqual(
    expect.objectContaining({ name: '补录奖励', money: 10000, points: 2 }),
  );
  await expect(types.create(dad, { name: '补录奖励', money: 20000, points: 1 })).rejects.toThrow();
  await expect(types.create(dad, { name: '非法金额', money: 1.5, points: 1 })).rejects.toThrow();
  expect(await f.db.recordType.count()).toBe(1);
});
it('新类型记录三次，确认时钱包不变，月底根据对应表统一入账', async () => {
  const type = (await types.list())[0];
  const e = await family.record(dad, {
    subjectId: child.id,
    type: type.code,
    occurredAt: new Date('2026-09-20T10:00:00+08:00'),
    quantity: 3,
    reason: '补记三次已约定奖励',
    source: '首次奖励补录',
    evidence: '{}',
    requestKey: crypto.randomUUID(),
  });
  await family.decide(dad, e.id, 'CONFIRM', crypto.randomUUID());
  await family.decide(child, e.id, 'CONFIRM', crypto.randomUUID());
  expect(await f.db.wallet.findUnique({ where: { subjectId: child.id } })).toMatchObject({
    money: 0,
    points: 0,
  });
  const summary = await family.generate(dad, child.id, '2026-09-18');
  const snap = JSON.parse(summary.snapshot);
  expect(snap.rules.custom[type.code]).toMatchObject({ money: 10000, points: 2 });
  expect(snap.summary).toMatchObject({ moneyDelta: 80000, pointsDelta: 6 });
  for (const actor of [dad, mom, child]) await family.confirmSummary(actor, summary.id);
  await family.post(dad, summary.id);
  expect(await f.db.wallet.findUnique({ where: { subjectId: child.id } })).toMatchObject({
    money: 80000,
    points: 6,
  });
});
it('旧结算快照不覆盖，新对应表使未入账的旧总结失效', async () => {
  const old = await f.db.settlement.findFirstOrThrow({ where: { postedAt: { not: null } } });
  const snapshot = old.snapshot;
  const draft = await family.generate(dad, child.id, '2026-10-18');
  await types.create(mom, { name: '认真阅读奖励', money: 500, points: 1 });
  await expect(family.confirmSummary(child, draft.id)).rejects.toThrow('已变化');
  expect((await f.db.settlement.findUniqueOrThrow({ where: { id: old.id } })).snapshot).toBe(
    snapshot,
  );
});
