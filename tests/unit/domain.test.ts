import { describe, expect, it } from 'vitest';
import { periodFor, localDay } from '../../src/domain/periods';
import { calculate, DEFAULT_RULES, type Fact } from '../../src/domain/rules';
const fact = (type: string, evidence = '{}', quantity = 1): Fact => ({
  id: crypto.randomUUID(),
  type,
  evidence,
  quantity,
  occurredAt: new Date('2026-10-20T04:00:00Z'),
  reverseOf: null,
});
describe('协议月', () => {
  it('按北京时间和原始月末锚点计算，左闭右开', () => {
    const p = periodFor('2026-01-31', new Date('2026-03-01T00:00:00+08:00'));
    expect(localDay(p.start)).toBe('2026-02-28');
    expect(localDay(p.end)).toBe('2026-03-31');
    expect(localDay(periodFor('2026-01-31', p.end).start)).toBe('2026-03-31');
  });
  it('拒绝锚点之前、非法日期', () => {
    expect(() => periodFor('2026-02-30', new Date())).toThrow();
    expect(() => periodFor('2026-10-20', new Date('2026-01-01'))).toThrow();
  });
});
describe('月度计算', () => {
  it.each([
    ['A+', 20000],
    ['A', 10000],
    ['B', -10000],
    ['C', -20000],
  ])('学校等级 %s', (grade, value) =>
    expect(
      calculate([fact('SCHOOL', JSON.stringify({ grade }))], DEFAULT_RULES, false).moneyDelta,
    ).toBe(value),
  );
  it.each([
    [79.9, -10000],
    [80, 0],
    [89.9, 0],
    [90, 10000],
  ])('基础卷 %s 分', (score, value) =>
    expect(
      calculate([fact('BASIC', JSON.stringify({ score }))], DEFAULT_RULES, false).moneyDelta,
    ).toBe(value),
  );
  it.each([
    [74.9, -10000],
    [75, 0],
    [84.9, 0],
    [85, 10000],
  ])('拓展卷 %s 分', (score, value) =>
    expect(
      calculate([fact('ADVANCED', JSON.stringify({ score }))], DEFAULT_RULES, false).moneyDelta,
    ).toBe(value),
  );
  it('分别封顶，顺序无关，不改原始记录', () => {
    const facts = [fact('SCHOOL', '{"grade":"A"}', 13), fact('SHOUT', '{}', 2)];
    expect(calculate(facts, DEFAULT_RULES, false)).toMatchObject({
      rawReward: 130000,
      rawDeduction: 20000,
      moneyDelta: 80000,
    });
    expect(calculate([...facts].reverse(), DEFAULT_RULES, false)).toEqual(
      calculate(facts, DEFAULT_RULES, false),
    );
    expect(facts[0].quantity).toBe(13);
  });
  it('哭泣查询自动决定月度候选，积分独立含跳过', () => {
    expect(calculate([], DEFAULT_RULES, true).monthlyBonus).toBe(50000);
    expect(calculate([fact('CRY')], DEFAULT_RULES, true).monthlyBonus).toBe(0);
    expect(
      calculate([fact('DICTATION', '{}', 11), fact('SKIP')], DEFAULT_RULES, false).pointsDelta,
    ).toBe(1);
  });
  it('反向事件抵销原方向，并恢复无哭泣候选', () => {
    const cry = fact('CRY');
    const reversal = { ...fact('REVERSAL'), reverseOf: cry.id };
    expect(calculate([cry, reversal], DEFAULT_RULES, true)).toMatchObject({
      rawDeduction: 0,
      cryCount: 0,
      monthlyBonus: 50000,
    });
  });
  it('反向扣减不进入奖励上限，拒绝重复抵销及未知事项', () => {
    const e = fact('SHOUT');
    const rev = { ...fact('REVERSAL'), reverseOf: e.id };
    expect(calculate([e, rev], DEFAULT_RULES, false)).toMatchObject({
      rawReward: 0,
      rawDeduction: 0,
    });
    expect(() => calculate([e, rev, { ...rev, id: 'other' }], DEFAULT_RULES, false)).toThrow();
    expect(() => calculate([fact('UNKNOWN')], DEFAULT_RULES)).toThrow();
  });
  it('拒绝非法分数和次数、孤立反向记录', () => {
    expect(() => calculate([fact('BASIC', '{"score":101}')], DEFAULT_RULES)).toThrow();
    expect(() => calculate([fact('CHORE', '{}', 0)], DEFAULT_RULES)).toThrow();
    expect(() =>
      calculate([{ ...fact('REVERSAL'), reverseOf: 'missing' }], DEFAULT_RULES),
    ).toThrow();
  });
});
describe('可定义的记录类型', () => {
  it('只记录类型和次数，金额积分在结算时按对应表计算', () => {
    const rules = {
      ...DEFAULT_RULES,
      custom: { CUSTOM_REWARD: { name: '补录奖励', money: 1250, points: 2 } },
    };
    expect(calculate([fact('CUSTOM_REWARD', '{}', 3)], rules, false)).toMatchObject({
      moneyDelta: 3750,
      pointsDelta: 6,
    });
  });
  it('同一记录可随本次结算所采用的类型表计算，旧快照保持原值', () => {
    const event = fact('CUSTOM_REWARD');
    const oldRules = {
      ...DEFAULT_RULES,
      custom: { CUSTOM_REWARD: { name: '补录奖励', money: 10000, points: 1 } },
    };
    const nextRules = {
      ...oldRules,
      custom: { CUSTOM_REWARD: { name: '补录奖励', money: 20000, points: 2 } },
    };
    expect(calculate([event], oldRules, false).moneyDelta).toBe(10000);
    expect(calculate([event], nextRules, false).moneyDelta).toBe(20000);
  });
  it('定额奖励与原协议奖励一起封顶，反向记录按原类型抵销', () => {
    const rules = {
      ...DEFAULT_RULES,
      custom: { CUSTOM_REWARD: { name: '补录奖励', money: 10000, points: 1 } },
    };
    const e = fact('CUSTOM_REWARD', '{}', 12);
    expect(calculate([e], rules, false)).toMatchObject({
      rawReward: 120000,
      reward: 100000,
      pointsDelta: 12,
    });
    expect(
      calculate([e, { ...fact('REVERSAL', '{}', 2), reverseOf: e.id }], rules, false),
    ).toMatchObject({ rawReward: 100000, pointsDelta: 10 });
  });
});
