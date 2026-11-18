import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase } from '../support/database';
import { Accounts } from '../../src/server/accounts';
import { Family } from '../../src/services/family';
import { makeSnapshot, previewPeriod } from '../../src/services/summary';
import { DEFAULT_RULES } from '../../src/domain/rules';
import type { Actor } from '../../src/server/permissions';
const fixture = testDatabase();
const start = '2026-10-19';
let dad: Actor, family: Family, accounts: Accounts;
beforeAll(async () => {
  await fixture.init();
  accounts = new Accounts(fixture.db);
  dad = await accounts.create('dad', '爸爸', 'ADMIN', 'test-password-123', 0, 0);
  await accounts.setup(dad, start);
  family = new Family(fixture.db, () => new Date('2026-12-20T12:00:00+08:00'));
});
afterAll(() => fixture.close());
const subject = () =>
  accounts.create(crypto.randomUUID(), 'Ellie', 'USER', 'test-password-123', 0, 0);
async function add(user: Actor, type: string, evidence = '{}', day = '2026-11-01', confirm = true) {
  const e = await family.record(dad, {
    subjectId: user.id,
    type,
    evidence,
    occurredAt: new Date(day + 'T12:00:00+08:00'),
    quantity: 1,
    reason: '因学习困难哭泣或考试记录',
    source: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
  });
  if (confirm) await family.decide(user, e.id, 'CONFIRM', crypto.randomUUID());
  return e;
}
async function preview(user: Actor) {
  return previewPeriod(await family.history(user, user.id), start, DEFAULT_RULES);
}
describe('本协议月展示口径', () => {
  it('复现线上四笔事实：净额 -200 元、0 积分；500 元奖励独立，不改变结算', async () => {
    const user = await subject();
    for (const [type, evidence] of [
      ['ADVANCED', '{"score":55}'],
      ['SCHOOL', '{"grade":"A"}'],
      ['ADVANCED', '{"score":40}'],
      ['BASIC', '{"score":79}'],
    ])
      await add(user, type, evidence);
    expect(await preview(user)).toMatchObject({
      records: { reward: 10000, deduction: 30000, moneyDelta: -20000, pointsDelta: 0 },
      bonus: { status: 'eligible', amount: 50000 },
      pendingCount: 0,
    });
    const history = await family.history(user, user.id);
    expect(await makeSnapshot(fixture.db, user.id, start, history)).toMatchObject({
      moneyTotal: 30000,
      pointsTotal: 0,
    });
    await add(user, 'DICTATION');
    expect((await preview(user)).records.pointsDelta).toBe(1);
  });
  it('无记录仅显示月度候选，不把奖励预先加进记录净额', async () => {
    const user = await subject();
    expect(await preview(user)).toMatchObject({
      records: { moneyDelta: 0, pointsDelta: 0 },
      bonus: { status: 'eligible', amount: 50000 },
    });
  });
  it('待确认和异议不计净额；本期哭泣待核对，其他期哭泣不影响本期', async () => {
    const user = await subject();
    await add(user, 'CRY', '{}', '2026-11-20');
    await add(user, 'DICTATION', '{}', '2026-11-01', false);
    expect(await preview(user)).toMatchObject({
      records: { pointsDelta: 0 },
      bonus: { status: 'eligible' },
      pendingCount: 1,
    });
    const cry = await add(user, 'CRY', '{}', '2026-11-02', false);
    await family.decide(user, cry.id, 'DISPUTE', crypto.randomUUID(), '核对原因');
    const result = await preview(user);
    expect(result.bonus.status).toBe('pending');
    expect(result.bonus.pending.map((e) => e.id)).toEqual([cry.id]);
    expect(result.records.moneyDelta).toBe(0);
  });
  it('已确认哭泣列出日期原因；待确认更正仍不满足，确认抵销后恢复候选，删除不计', async () => {
    const user = await subject();
    const cry = await add(user, 'CRY');
    let result = await preview(user);
    expect(result.bonus.status).toBe('blocked');
    expect(result.bonus.blockers[0]).toMatchObject({
      id: cry.id,
      reason: cry.reason,
      occurredAt: cry.occurredAt,
    });
    const reversal = await family.reverse(dad, cry.id, '认定有误', crypto.randomUUID());
    result = await preview(user);
    expect(result.bonus.status).toBe('blocked');
    expect(result.bonus.pending.map((e) => e.id)).toContain(reversal.id);
    await family.decide(user, reversal.id, 'CONFIRM', crypto.randomUUID());
    expect(await preview(user)).toMatchObject({
      records: { moneyDelta: 0, cryCount: 0 },
      bonus: { status: 'eligible', blockers: [] },
    });
    const deleted = await add(user, 'CRY', '{}', '2026-11-03', false);
    await family.remove(dad, deleted.id);
    expect((await preview(user)).bonus.status).toBe('eligible');
  });
});
