import { confirmationState } from '../domain/confirmation';
import { currentRules } from '../server/record-types';
import { calculate, effectiveFacts, type Rules } from '../domain/rules';
import { localDay, parseDay, periodFor } from '../domain/periods';
import { confirmedFacts, type History, type Connection } from './state';
export type Adjustment = { periodStart: string; money: number; points: number; eventIds: string[] };
export type Snapshot = {
  summary: ReturnType<typeof calculate>;
  adjustments: Adjustment[];
  rules: Rules;
  eventIds: string[];
  participants: { id: string; name: string; role?: string }[];
  moneyTotal: number;
  pointsTotal: number;
};
export function factsForPeriod(history: History, start: string, cutoff: string) {
  const eligible = history.filter((e) => e.periodStart <= cutoff);
  const facts = confirmedFacts(eligible);
  const ids = new Set(
    facts
      .filter((e) => !e.reverseOf && history.find((h) => h.id === e.id)?.periodStart === start)
      .map((e) => e.id),
  );
  return facts.filter((e) => ids.has(e.id) || (e.reverseOf && ids.has(e.reverseOf)));
}
export function previewPeriod(history: History, start: string, rules: Rules) {
  const facts = factsForPeriod(history, start, start);
  const cryIds = new Set(
    effectiveFacts(facts)
      .filter((e) => e.type === 'CRY')
      .map((e) => e.id),
  );
  const blockers = history.filter((e) => cryIds.has(e.id));
  const unresolved = history.filter(
    (e) => e.periodStart === start && !['CONFIRMED', 'REVERSED'].includes(e.status),
  );
  const pending = unresolved.filter(
    (e) =>
      e.type === 'CRY' ||
      (e.reverseOf && history.some((o) => o.id === e.reverseOf && o.type === 'CRY')),
  );
  const status = blockers.length ? 'blocked' : pending.length ? 'pending' : 'eligible';
  return {
    records: calculate(facts, rules, false),
    pendingCount: unresolved.length,
    bonus: { status, amount: rules.monthlyBonus, blockers, pending },
  };
}
export async function makeSnapshot(
  db: Connection,
  subjectId: string,
  start: string,
  history: History,
) {
  const { rules } = await currentRules(db);
  const facts = factsForPeriod(history, start, start);
  const summary = calculate(facts, rules);
  const posted = await db.settlement.findMany({ where: { subjectId, postedAt: { not: null } } });
  const adjustments: Adjustment[] = [];
  for (const old of posted.filter((s) => s.periodStart < start)) {
    const original = JSON.parse(old.snapshot) as Snapshot;
    const revisedFacts = factsForPeriod(history, old.periodStart, start);
    const target = calculate(revisedFacts, original.rules);
    const consumed = posted
      .flatMap((s) => (JSON.parse(s.snapshot) as Snapshot).adjustments ?? [])
      .filter((a) => a.periodStart === old.periodStart);
    const money =
      target.moneyDelta - original.summary.moneyDelta - consumed.reduce((n, a) => n + a.money, 0);
    const points =
      target.pointsDelta -
      original.summary.pointsDelta -
      consumed.reduce((n, a) => n + a.points, 0);
    if (money || points)
      adjustments.push({
        periodStart: old.periodStart,
        money,
        points,
        eventIds: revisedFacts.map((f) => f.id),
      });
  }
  const participants = await db.user.findMany({
    where: { active: true, OR: [{ role: 'ADMIN' }, { id: subjectId }] },
    select: { id: true, name: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  return {
    summary,
    adjustments,
    rules,
    eventIds: facts.map((f) => f.id),
    participants,
    moneyTotal: summary.moneyDelta + adjustments.reduce((n, a) => n + a.money, 0),
    pointsTotal: summary.pointsDelta + adjustments.reduce((n, a) => n + a.points, 0),
  } satisfies Snapshot;
}
export async function getPeriod(db: Connection, at: Date) {
  const settings = await db.setting.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error('请先由管理员设置协议月');
  const period = periodFor(settings.anchor, at);
  return { start: localDay(period.start), end: localDay(period.end) };
}
export async function validateSummary(db: Connection, id: string) {
  const settlement = await db.settlement.findUnique({ where: { id } });
  if (!settlement) throw new Error('结算单不存在');
  if (!settlement.postedAt) {
    const user = await db.user.findUniqueOrThrow({ where: { id: settlement.subjectId } });
    const active = await currentRules(db);
    if (user.revision !== settlement.revision || active.key !== settlement.rulesKey)
      throw new Error('事实或规则已变化，请重新生成并确认总结');
  }
  return settlement;
}
export { parseDay };

export function summaryConfirmation(
  settlement: { subjectId: string; actorId: string; snapshot: string },
  decisions: { actorId: string }[],
) {
  const snapshot = JSON.parse(settlement.snapshot) as Snapshot;
  // Older snapshots omitted roles; their participants were all admins plus the subject.
  const adminIds = snapshot.participants
    .filter((p) => p.role === 'ADMIN' || (!p.role && p.id !== settlement.subjectId))
    .map((p) => p.id);
  return confirmationState(
    { subjectId: settlement.subjectId, creatorId: settlement.actorId, adminIds },
    decisions.map((d) => ({ actorId: d.actorId, decision: 'CONFIRM' })),
  );
}
