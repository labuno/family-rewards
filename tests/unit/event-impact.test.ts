import { describe, expect, it } from 'vitest';
import { eventImpact } from '../../src/domain/event-impact';
import { DEFAULT_RULES, type Fact } from '../../src/domain/rules';
const fact = (type: string, evidence = '{}', quantity = 1): Fact => ({
  id: crypto.randomUUID(),
  type,
  evidence,
  quantity,
  occurredAt: new Date('2026-11-01T12:00:00+08:00'),
  reverseOf: null,
});
describe('单笔协议变化', () => {
  it('按成绩及次数计算奖励扣减，积分独立，零变化不奖励', () => {
    expect(eventImpact(fact('BASIC', '{"score":79}', 3), DEFAULT_RULES)).toEqual({
      money: -30000,
      points: 0,
    });
    expect(
      eventImpact(fact('SCHOOL', '{"grade":"A","schoolYear":"三年级上"}'), DEFAULT_RULES),
    ).toEqual({ money: 10000, points: 0 });
    expect(eventImpact(fact('DICTATION', '{}', 2), DEFAULT_RULES)).toEqual({ money: 0, points: 2 });
    expect(eventImpact(fact('SKIP'), DEFAULT_RULES)).toEqual({ money: 0, points: -10 });
    expect(eventImpact(fact('ADVANCED', '{"score":80}'), DEFAULT_RULES)).toEqual({
      money: 0,
      points: 0,
    });
  });
  it('支持自定义类型同时产生两种资产，单笔值不套月度封顶', () => {
    const rules = {
      ...DEFAULT_RULES,
      custom: { CUSTOM_READ: { name: '阅读', money: 20000, points: -1 } },
    };
    expect(eventImpact(fact('CUSTOM_READ', '{}', 6), rules)).toEqual({ money: 120000, points: -6 });
  });
  it('反向记录从完整历史找到原事项，抵销原金额和积分方向', () => {
    const original = fact('BASIC', '{"score":55}', 3);
    const reversal = { ...fact('REVERSAL', '{}', 2), reverseOf: original.id };
    expect(eventImpact(reversal, DEFAULT_RULES, [original])).toEqual({ money: 20000, points: 0 });
    const points = fact('DICTATION');
    expect(
      eventImpact({ ...fact('REVERSAL'), reverseOf: points.id }, DEFAULT_RULES, [points]),
    ).toEqual({ money: 0, points: -1 });
  });
});
