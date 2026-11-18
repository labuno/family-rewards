import { z } from 'zod';
import type { Database } from './db';
import { authorize, type Actor } from './permissions';
import { currentRules } from './record-types';
import { Family } from '../services/family';
import { getPeriod, previewPeriod, summaryConfirmation, type Snapshot } from '../services/summary';
import { EVENT_LABELS, rate } from '../domain/rules';
import { readAsset, eventMatchesAsset, typeMatchesAsset } from '../domain/assets';
import { eventImpact } from '../domain/event-impact';
import type { History } from '../services/state';

async function subjectView(db: Database, actor: Actor, query: URLSearchParams) {
  const users = await db.user.findMany({
    where: { active: true, ...(actor.role === 'ADMIN' ? {} : { id: actor.id }) },
    select: { id: true, name: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  const id = query.get('subject') ?? users.find((u) => u.role === 'USER')?.id ?? actor.id;
  authorize(actor, id);
  const subject = users.find((u) => u.id === id);
  if (!subject) throw new Error('用户不存在');
  return { users, subject };
}
function projectEvents(events: History, rules: Awaited<ReturnType<typeof currentRules>>['rules']) {
  return events.map((e) => ({
    ...e,
    label: e.typeName ?? EVENT_LABELS[e.type] ?? e.type,
    impact: eventImpact(e, rules, events),
  }));
}
async function eventDetail(db: Database, actor: Actor, id: string) {
  const raw = await db.event.findUnique({ where: { id } });
  if (!raw || raw.deletedAt) throw new Error('记录不存在');
  const history = await new Family(db).history(actor, raw.subjectId);
  const { rules } = await currentRules(db);
  const event = projectEvents(history, rules).find((e) => e.id === id)!;
  const posted = !!(await db.settlement.findFirst({
    where: { subjectId: raw.subjectId, periodStart: raw.periodStart, postedAt: { not: null } },
  }));
  return {
    event,
    posted,
    canConfirm: !posted && !event.confirmedIds.includes(actor.id),
    canDispute: !posted && ['PENDING', 'DISPUTED'].includes(event.status),
    canDelete:
      !posted &&
      event.actorId === actor.id &&
      !event.decisions.some((d) => d.actorId !== actor.id && d.decision === 'CONFIRM') &&
      !history.some((e) => e.reverseOf === id),
    canReverse: !event.reverseOf && event.status !== 'REVERSED',
  };
}
async function settlementDetail(db: Database, actor: Actor, id: string) {
  const settlement = await db.settlement.findUnique({ where: { id } });
  if (!settlement) throw new Error('结算单不存在');
  authorize(actor, settlement.subjectId);
  const user = await db.user.findUniqueOrThrow({ where: { id: settlement.subjectId } });
  const approvals = await db.settlementDecision.findMany({ where: { settlementId: id } });
  const { key } = await currentRules(db);
  const stale =
    !settlement.postedAt && (user.revision !== settlement.revision || key !== settlement.rulesKey);
  const confirmation = summaryConfirmation(settlement, approvals);
  const snapshot = JSON.parse(settlement.snapshot) as Snapshot;
  const active = !settlement.postedAt && !stale;
  return {
    settlement,
    snapshot,
    counts: Object.entries(snapshot.summary.counts).map(([code, count]) => ({
      code,
      count,
      label: snapshot.rules.custom[code]?.name ?? EVENT_LABELS[code] ?? code,
    })),
    approvals,
    confirmation,
    stale,
    canConfirm: active && !confirmation.approvedIds.includes(actor.id),
    canPost: active && actor.role === 'ADMIN' && confirmation.status === 'CONFIRMED',
  };
}
type Rules = Awaited<ReturnType<typeof currentRules>>['rules'];
function typeCatalogue(rules: Rules, asset: ReturnType<typeof readAsset>) {
  const labels = {
    ...EVENT_LABELS,
    ...Object.fromEntries(Object.entries(rules.custom).map(([code, value]) => [code, value.name])),
  };
  return {
    rules,
    types: Object.entries(labels)
      .filter(([code]) => code !== 'REVERSAL' && (!asset || typeMatchesAsset(code, asset, rules)))
      .map(([code, name]) => ({ ...rules.custom[code], code, name })),
  };
}
function preview(query: URLSearchParams, rules: Rules) {
  const quantity = z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .parse(query.get('quantity') ?? 1);
  const type = z.string().min(1).parse(query.get('type'));
  if (['CHORE', 'SKIP'].includes(type) && quantity !== 1) throw new Error('该事项每次只能登记一次');
  if (['BASIC', 'ADVANCED'].includes(type) && !query.get('score')?.trim())
    throw new Error('请填写试卷分数');
  const value = rate(
    type,
    JSON.stringify({
      grade: query.get('grade'),
      score: query.has('score') ? Number(query.get('score')) : undefined,
    }),
    rules,
  );
  return { impact: { money: value.money * quantity, points: value.points * quantity } };
}
function historyPage(events: History, rules: Rules, query: URLSearchParams) {
  const asset = readAsset(query.get('asset') ?? undefined);
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .parse(query.get('page') ?? 1);
  const filtered = projectEvents(events, rules).filter(
    (e) =>
      (!asset || eventMatchesAsset(e, asset, rules, events)) &&
      (!query.get('type') || e.type === query.get('type')) &&
      (!query.get('status') || e.status === query.get('status')) &&
      (!query.get('period') || e.periodStart === query.get('period')),
  );
  return {
    events: filtered.slice((page - 1) * 20, page * 20),
    page,
    hasMore: filtered.length > page * 20,
    total: filtered.length,
  };
}
async function dashboard(db: Database, subjectId: string, events: History, rules: Rules) {
  const period = await getPeriod(db, new Date());
  const wallet = await db.wallet.findUniqueOrThrow({ where: { subjectId } });
  const projected = projectEvents(events, rules);
  return {
    needsSetup: false,
    wallet,
    period,
    preview: previewPeriod(events, period.start, rules),
    pending: projected.filter((e) => ['PENDING', 'DISPUTED'].includes(e.status)),
    recent: projected.slice(0, 5),
  };
}
export async function miniQuery(db: Database, actor: Actor, query: URLSearchParams) {
  const resource = query.get('resource') ?? 'dashboard';
  if (resource === 'event') return eventDetail(db, actor, z.string().min(1).parse(query.get('id')));
  if (resource === 'settlement')
    return settlementDetail(db, actor, z.string().min(1).parse(query.get('id')));
  const { rules } = await currentRules(db);
  if (resource === 'types') return typeCatalogue(rules, readAsset(query.get('asset') ?? undefined));
  if (resource === 'preview') return preview(query, rules);
  const context = await subjectView(db, actor, query);
  const subjectId = context.subject.id;
  if (resource === 'settlements')
    return {
      ...context,
      settlements: await db.settlement.findMany({
        where: { subjectId },
        orderBy: { createdAt: 'desc' },
      }),
    };
  const setting = await db.setting.findUnique({ where: { id: 1 } });
  if (!setting) return { ...context, actor, needsSetup: true };
  const events = await new Family(db).history(actor, subjectId);
  if (resource === 'history') return { ...context, ...historyPage(events, rules, query) };
  if (resource !== 'dashboard') throw new Error('不支持的查询');
  return { ...context, actor, ...(await dashboard(db, subjectId, events, rules)) };
}
