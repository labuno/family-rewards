import type { Fact, Rules } from './rules';

export type Asset = 'MONEY' | 'POINTS';
export function readAsset(value?: string): Asset | undefined {
  if (!value) return undefined;
  if (value === 'MONEY' || value === 'POINTS') return value;
  throw new Error('钱包类别无效');
}
export function typeMatchesAsset(type: string, asset: Asset, rules: Rules) {
  const custom = rules.custom[type];
  if (custom) return asset === 'MONEY' ? custom.money !== 0 : custom.points !== 0;
  return asset === 'POINTS'
    ? ['CHORE', 'DICTATION', 'SKIP'].includes(type)
    : ['SCHOOL', 'BASIC', 'ADVANCED', 'CRY', 'SHOUT'].includes(type);
}
export function eventMatchesAsset(event: Fact, asset: Asset, rules: Rules, history: Fact[]) {
  const original = event.reverseOf ? history.find((e) => e.id === event.reverseOf) : event;
  if (!original) throw new Error('找不到反向记录的原事项');
  return typeMatchesAsset(original.type, asset, rules);
}
