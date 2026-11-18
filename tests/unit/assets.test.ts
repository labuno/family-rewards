import { describe, expect, it } from 'vitest';
import { eventMatchesAsset, readAsset, typeMatchesAsset } from '../../src/domain/assets';
import { DEFAULT_RULES, type Fact } from '../../src/domain/rules';
const fact = (type: string): Fact => ({
  id: crypto.randomUUID(),
  type,
  evidence: '{}',
  quantity: 1,
  occurredAt: new Date('2026-11-02T12:00:00+08:00'),
  reverseOf: null,
});
describe('钱包事项范围', () => {
  it('金钱与积分预设类型互不混入，零金额考试仍在金钱事项', () => {
    for (const type of ['SCHOOL', 'BASIC', 'ADVANCED', 'CRY', 'SHOUT']) {
      expect(typeMatchesAsset(type, 'MONEY', DEFAULT_RULES)).toBe(true);
      expect(typeMatchesAsset(type, 'POINTS', DEFAULT_RULES)).toBe(false);
    }
    for (const type of ['CHORE', 'DICTATION', 'SKIP']) {
      expect(typeMatchesAsset(type, 'POINTS', DEFAULT_RULES)).toBe(true);
      expect(typeMatchesAsset(type, 'MONEY', DEFAULT_RULES)).toBe(false);
    }
    expect(
      eventMatchesAsset({ ...fact('BASIC'), evidence: '{"score":85}' }, 'MONEY', DEFAULT_RULES, []),
    ).toBe(true);
  });
  it('自定义事项按资产归属，双资产属于两页，两个值均0不进钱包', () => {
    const rules = {
      ...DEFAULT_RULES,
      custom: {
        CUSTOM_MONEY: { name: '金额', money: 10000, points: 0 },
        CUSTOM_POINTS: { name: '积分', money: 0, points: 1 },
        CUSTOM_BOTH: { name: '两者', money: 100, points: 1 },
        CUSTOM_ZERO: { name: '零', money: 0, points: 0 },
      },
    };
    expect(typeMatchesAsset('CUSTOM_MONEY', 'POINTS', rules)).toBe(false);
    expect(typeMatchesAsset('CUSTOM_POINTS', 'MONEY', rules)).toBe(false);
    for (const asset of ['MONEY', 'POINTS'] as const) {
      expect(typeMatchesAsset('CUSTOM_BOTH', asset, rules)).toBe(true);
      expect(typeMatchesAsset('CUSTOM_ZERO', asset, rules)).toBe(false);
    }
  });
  it('反向事项从完整历史继承原资产', () => {
    const money = fact('SHOUT'),
      points = fact('DICTATION');
    expect(
      eventMatchesAsset({ ...fact('REVERSAL'), reverseOf: money.id }, 'MONEY', DEFAULT_RULES, [
        money,
        points,
      ]),
    ).toBe(true);
    expect(
      eventMatchesAsset({ ...fact('REVERSAL'), reverseOf: money.id }, 'POINTS', DEFAULT_RULES, [
        money,
        points,
      ]),
    ).toBe(false);
    expect(
      eventMatchesAsset({ ...fact('REVERSAL'), reverseOf: points.id }, 'POINTS', DEFAULT_RULES, [
        money,
        points,
      ]),
    ).toBe(true);
  });
  it('解析有无范围，拒绝未知钱包类别', () => {
    expect(readAsset(undefined)).toBeUndefined();
    expect(readAsset('MONEY')).toBe('MONEY');
    expect(readAsset('POINTS')).toBe('POINTS');
    expect(() => readAsset('OTHER')).toThrow('钱包类别无效');
  });
});
