import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { testDatabase } from '../support/database';
import { Accounts } from '../../src/server/accounts';
import { Family } from '../../src/services/family';
import type { Actor } from '../../src/server/permissions';
const fixture = testDatabase();
let family: Family, dad: Actor, mom: Actor, ellie: Actor;
let clock = new Date('2026-11-20T12:00:00+08:00');
const at = (day: string) => new Date(day + 'T12:00:00+08:00');
const key = () => crypto.randomUUID();
async function add(
  type: string,
  day = '2026-09-20',
  subject = ellie,
  evidence = '{}',
  quantity = 1,
) {
  return family.record(dad, {
    subjectId: subject.id,
    type: type as import('../../src/services/family').RecordInput['type'],
    occurredAt: at(day),
    reason: '测试事项依据',
    evidence,
    quantity,
    source: key(),
    requestKey: key(),
  });
}
async function confirmed(event: { id: string }, subject = ellie) {
  await family.decide(dad, event.id, 'CONFIRM', key());
  await family.decide(subject, event.id, 'CONFIRM', key());
  return event;
}
beforeAll(async () => {
  await fixture.init();
  const a = new Accounts(fixture.db);
  dad = await a.create('dad', '爸爸', 'ADMIN', 'test-password-123', 0, 0);
  mom = await a.create('mom', '妈妈', 'ADMIN', 'test-password-123', 0, 0);
  ellie = await a.create('ellie', 'Ellie', 'USER', 'test-password-123', 5000, 20);
  await a.setup(dad, '2026-09-18');
  family = new Family(fixture.db, () => clock);
});
afterAll(() => fixture.close());
describe('事件与结算', () => {
  it('登记、重复提交与确认不改钱包，未确认事项必须在月底处理', async () => {
    const input = {
      subjectId: ellie.id,
      type: 'CRY' as const,
      occurredAt: at('2026-09-20'),
      reason: '压力需要沟通',
      evidence: '{}',
      quantity: 1,
      source: key(),
      requestKey: key(),
    };
    const e = await family.record(dad, input);
    expect((await family.record(dad, input)).id).toBe(e.id);
    await expect(family.generate(dad, ellie.id, '2026-09-18')).rejects.toThrow('未确认');
    await confirmed(e);
    expect((await fixture.db.wallet.findUnique({ where: { subjectId: ellie.id } }))?.money).toBe(
      5000,
    );
  });
  it('跨用户权限和非法输入在数据库边界拒绝', async () => {
    await expect(
      family.record(ellie, {
        subjectId: dad.id,
        type: 'CHORE',
        occurredAt: at('2026-09-20'),
        reason: '家务',
        evidence: '{}',
        quantity: 1,
        source: key(),
        requestKey: key(),
      }),
    ).rejects.toThrow('没有权限');
    await expect(add('UNKNOWN')).rejects.toThrow();
    await expect(add('BASIC', '2026-09-20', ellie, '{"score":101}')).rejects.toThrow();
    await expect(family.history(ellie, dad.id)).rejects.toThrow('没有权限');
  });
  it('同一天家务最多一次，异议及确认留痕', async () => {
    await confirmed(await add('CHORE'));
    const e = await add('CHORE');
    await family.decide(dad, e.id, 'CONFIRM', key());
    await expect(family.decide(ellie, e.id, 'CONFIRM', key())).rejects.toThrow('同一天');
    await family.decide(dad, e.id, 'DISPUTE', key(), '重复记录');
    expect((await family.history(dad, ellie.id)).find((x) => x.id === e.id)?.status).toBe(
      'DISPUTED',
    );
    // Reject the duplicate through a confirmed reversal; do not delete its history.
    const rev = await family.reverse(dad, e.id, '重复家务更正', key());
    await family.decide(ellie, rev.id, 'CONFIRM', key());
    await family.decide(dad, rev.id, 'CONFIRM', key());
  });
  it('试卷跳过只能使用已结算积分，自然月最多一次', async () => {
    await confirmed(await add('SKIP'));
    await expect(add('SKIP')).rejects.toThrow('本自然月');
    const poor = await new Accounts(fixture.db).create(
      'poor',
      '小朋友',
      'USER',
      'test-password-123',
      0,
      0,
    );
    await confirmed(await add('DICTATION', '2026-09-20', poor, '{}', 20), poor);
    await expect(add('SKIP', '2026-09-20', poor)).rejects.toThrow('已结算积分');
  });
  it('只有事实全部确认才可生成；摘要三方确认后统一入账，允许负钱', async () => {
    // The duplicate CHORE and reversal net to zero; confirmation can resolve the original dispute once neutralized.
    const events = await family.history(dad, ellie.id);
    for (const e of events.filter((x) => x.status !== 'CONFIRMED')) await confirmed(e);
    await confirmed(await add('SHOUT', '2026-09-21', ellie, '{}', 1));
    const s = await family.generate(dad, ellie.id, '2026-09-18');
    await expect(family.post(dad, s.id)).rejects.toThrow('确认');
    for (const a of [dad, mom, ellie]) await family.confirmSummary(a, s.id);
    await family.post(dad, s.id);
    await family.post(dad, s.id);
    const wallet = await fixture.db.wallet.findUniqueOrThrow({ where: { subjectId: ellie.id } });
    expect(wallet.money).toBe(-15000);
    expect(wallet.points).toBe(11);
    expect(await fixture.db.walletEntry.count({ where: { settlementId: s.id } })).toBe(2);
  });
  it('原数据不删除，已结算哭泣反向更正进入下期调整，恢复月奖励', async () => {
    const cry = (await family.history(dad, ellie.id)).find((e) => e.type === 'CRY')!;
    const reversal = await family.reverse(dad, cry.id, '哭泣认定错误', key());
    await confirmed(reversal);
    await expect(family.reverse(dad, cry.id, '再次冲回', key())).rejects.toThrow('超过');
    clock = at('2026-12-20');
    const s = await family.generate(dad, ellie.id, '2026-11-18');
    const snap = JSON.parse(s.snapshot);
    expect(snap.adjustments[0]).toMatchObject({ money: 60000, points: 0 });
    expect(await fixture.db.event.findUnique({ where: { id: cry.id } })).not.toBeNull();
    for (const a of [dad, mom, ellie]) await family.confirmSummary(a, s.id);
    await family.post(dad, s.id);
    expect(
      (await fixture.db.wallet.findUniqueOrThrow({ where: { subjectId: ellie.id } })).money,
    ).toBe(95000);
  });
  it('总结之后有新记录，旧确认不能入账；未来周期不能提前结算', async () => {
    await expect(family.generate(dad, ellie.id, '2026-11-18')).resolves.toBeDefined();
    await expect(family.generate(dad, ellie.id, '2026-12-18')).rejects.toThrow('尚未结束');
    const s = await family.generate(dad, ellie.id, '2026-10-18');
    await confirmed(await add('DICTATION', '2026-10-20'));
    await expect(family.confirmSummary(ellie, s.id)).rejects.toThrow('已变化');
  });
  it('事务中途失败时两钱包、流水和已入账状态一并回滚', async () => {
    const s = await family.generate(dad, ellie.id, '2026-10-18');
    for (const a of [dad, mom, ellie]) await family.confirmSummary(a, s.id);
    const before = await fixture.db.wallet.findUniqueOrThrow({ where: { subjectId: ellie.id } });
    await fixture.db.$executeRawUnsafe(
      `CREATE TRIGGER test_wallet_failure BEFORE INSERT ON "WalletEntry" WHEN NEW.asset='POINTS' AND NEW.settlementId='${s.id}' BEGIN SELECT RAISE(ABORT,'test failure'); END`,
    );
    await expect(family.post(dad, s.id)).rejects.toThrow();
    expect(await fixture.db.wallet.findUniqueOrThrow({ where: { subjectId: ellie.id } })).toEqual(
      before,
    );
    expect(await fixture.db.walletEntry.count({ where: { settlementId: s.id } })).toBe(0);
    expect(
      (await fixture.db.settlement.findUniqueOrThrow({ where: { id: s.id } })).postedAt,
    ).toBeNull();
    await fixture.db.$executeRawUnsafe('DROP TRIGGER test_wallet_failure');
  });
  it('两个独立连接同时入账，只能产生一组流水', async () => {
    const s = await family.generate(dad, ellie.id, '2026-10-18');
    const { createDatabase } = await import('../../src/server/db');
    const db2 = createDatabase(fixture.url);
    const second = new Family(db2, () => clock);
    const results = await Promise.allSettled([family.post(dad, s.id), second.post(dad, s.id)]);
    expect(results.some((x) => x.status === 'fulfilled')).toBe(true);
    expect(await fixture.db.walletEntry.count({ where: { settlementId: s.id } })).toBe(2);
    await db2.$disconnect();
  });
});
