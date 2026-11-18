export const DEFAULT_RULES = {
  custom: {} as Record<string, { name: string; money: number; points: number }>,
  revision: '2026-10-20-v1',
  cap: 100000,
  monthlyBonus: 50000,
  school: { 'A+': 20000, A: 10000, B: -10000, C: -20000 },
  basic: { high: 90, low: 80 },
  advanced: { high: 85, low: 75 },
  paperReward: 10000,
  paperDeduction: -10000,
  cry: -10000,
  shout: -10000,
  dictation: 1,
  chore: 1,
  skip: -10,
};
export type Rules = typeof DEFAULT_RULES;
export type Fact = {
  id: string;
  type: string;
  evidence: string;
  quantity: number;
  occurredAt: Date;
  reverseOf: string | null;
};
export const SHOUT_TARGETS = ['爷爷', '奶奶', '爸爸', '妈妈', '姑姑', '其他'] as const;
export const EVENT_LABELS: Record<string, string> = {
  SCHOOL: '学校考试',
  BASIC: '基础试卷',
  ADVANCED: '拓展试卷',
  SHOUT: '对长辈大吼大叫',
  CRY: '学习相关哭泣',
  DICTATION: '默写全对',
  CHORE: '主动做家务',
  SKIP: '跳过课外试卷',
  REVERSAL: '反向更正',
};
export function effectiveFacts(facts: Fact[]) {
  const originals = facts.filter((f) => !f.reverseOf);
  const quantities = new Map(originals.map((f) => [f.id, f.quantity]));
  for (const f of facts) {
    if (!Number.isSafeInteger(f.quantity) || f.quantity < 1) throw new Error('次数必须为正整数');
    if (!f.reverseOf) continue;
    const remaining = quantities.get(f.reverseOf);
    if (f.type !== 'REVERSAL' || remaining === undefined || remaining < f.quantity)
      throw new Error('反向记录无来源或超过原次数');
    quantities.set(f.reverseOf, remaining - f.quantity);
  }
  return originals
    .map((f) => ({ ...f, quantity: quantities.get(f.id)! }))
    .filter((f) => f.quantity > 0);
}
export function rate(type: string, evidence: string, rules: Rules) {
  if (Object.hasOwn(rules.custom ?? {}, type)) return rules.custom[type];
  const e = JSON.parse(evidence) as { grade?: string; score?: number };
  if (type === 'SCHOOL') {
    if (!e.grade || !Object.hasOwn(rules.school, e.grade)) throw new Error('请选择有效成绩等级');
    return { money: rules.school[e.grade as keyof Rules['school']], points: 0 };
  }
  if (type === 'BASIC' || type === 'ADVANCED') {
    if (typeof e.score !== 'number' || !Number.isFinite(e.score) || e.score < 0 || e.score > 100)
      throw new Error('分数须在 0 到 100 之间');
    const r = type === 'BASIC' ? rules.basic : rules.advanced;
    return {
      money: e.score >= r.high ? rules.paperReward : e.score < r.low ? rules.paperDeduction : 0,
      points: 0,
    };
  }
  const rates: Record<string, { money: number; points: number }> = {
    CRY: { money: rules.cry, points: 0 },
    SHOUT: { money: rules.shout, points: 0 },
    CHORE: { money: 0, points: rules.chore },
    DICTATION: { money: 0, points: rules.dictation },
    SKIP: { money: 0, points: rules.skip },
  };
  if (!rates[type]) throw new Error('不支持的事项');
  return rates[type];
}
export function calculate(facts: Fact[], rules: Rules = DEFAULT_RULES, includeBonus = true) {
  const effective = effectiveFacts(facts);
  let rawReward = 0,
    rawDeduction = 0,
    pointsDelta = 0,
    cryCount = 0;
  const counts: Record<string, number> = {};
  for (const f of effective) {
    const r = rate(f.type, f.evidence, rules);
    const amount = r.money * f.quantity;
    rawReward += Math.max(amount, 0);
    rawDeduction += Math.max(-amount, 0);
    pointsDelta += r.points * f.quantity;
    counts[f.type] = (counts[f.type] ?? 0) + f.quantity;
    if (f.type === 'CRY') cryCount += f.quantity;
  }
  const monthlyBonus = includeBonus && cryCount === 0 ? rules.monthlyBonus : 0;
  rawReward += monthlyBonus;
  const reward = Math.min(rawReward, rules.cap),
    deduction = Math.min(rawDeduction, rules.cap);
  return {
    rawReward,
    rawDeduction,
    reward,
    deduction,
    moneyDelta: reward - deduction,
    pointsDelta,
    cryCount,
    monthlyBonus,
    counts,
  };
}
