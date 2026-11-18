import { rate, type Fact, type Rules } from './rules';

export function eventImpact(event: Fact, rules: Rules, history: Fact[] = []) {
  const original = event.reverseOf ? history.find((e) => e.id === event.reverseOf) : event;
  if (!original) throw new Error('找不到反向记录的原事项');
  const value = rate(original.type, original.evidence, rules);
  const quantity = event.quantity * (event.reverseOf ? -1 : 1);
  return {
    money: value.money ? value.money * quantity : 0,
    points: value.points ? value.points * quantity : 0,
  };
}
