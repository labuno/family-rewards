import { confirmationState } from '../domain/confirmation';
import type { Prisma } from '../generated/prisma/client';
import { effectiveFacts, type Fact } from '../domain/rules';
export type Connection = Prisma.TransactionClient;
export async function readHistory(db: Connection, subjectId: string) {
  const events = await db.event.findMany({
    where: { subjectId, deletedAt: null },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
  });
  const decisions = await db.eventDecision.findMany({
    where: { eventId: { in: events.map((e) => e.id) } },
    orderBy: { createdAt: 'asc' },
  });
  const users = await db.user.findMany({ select: { id: true, name: true, role: true } });
  const names = new Map(users.map((u) => [u.id, u.name]));
  const admins = new Set(users.filter((u) => u.role === 'ADMIN').map((u) => u.id));
  const recordTypes = await db.recordType.findMany();
  const labels = new Map(recordTypes.map((t) => [t.code, t.name]));
  const result = events.map((event) => {
    const eventDecisions = decisions.filter((d) => d.eventId === event.id);
    const { status, approvedIds } = confirmationState(
      { subjectId, creatorId: event.actorId, adminIds: [...admins] },
      eventDecisions,
    );
    return {
      ...event,
      typeName: labels.get(event.type),
      status,
      actorName: names.get(event.actorId) ?? event.actorId,
      subjectName: names.get(event.subjectId) ?? event.subjectId,
      confirmedIds: approvedIds,
      confirmedBy: approvedIds.map((id) => names.get(id) ?? id),
      decisions: decisions
        .filter((d) => d.eventId === event.id)
        .map((d) => ({ ...d, name: names.get(d.actorId) ?? d.actorId })),
    };
  });
  return result.map((e) => {
    const reversed = result
      .filter((r) => r.reverseOf === e.id && r.status === 'CONFIRMED')
      .reduce((sum, r) => sum + r.quantity, 0);
    return { ...e, status: !e.reverseOf && reversed === e.quantity ? 'REVERSED' : e.status };
  });
}
export type History = Awaited<ReturnType<typeof readHistory>>;
export function confirmedFacts(history: History): Fact[] {
  const originals = history.filter(
    (e) => !e.reverseOf && ['CONFIRMED', 'REVERSED'].includes(e.status),
  );
  const ids = new Set(originals.map((e) => e.id));
  return [
    ...originals,
    ...history.filter((e) => e.reverseOf && ids.has(e.reverseOf) && e.status === 'CONFIRMED'),
  ];
}
export function validateLimits(history: History) {
  const effective = effectiveFacts(confirmedFacts(history));
  const days = new Set<string>(),
    months = new Set<string>();
  for (const f of effective) {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(f.occurredAt);
    if (f.type === 'CHORE') {
      if (f.quantity !== 1 || days.has(day)) throw new Error('同一天家务最多奖励一次');
      days.add(day);
    }
    if (f.type === 'SKIP') {
      if (f.quantity !== 1 || months.has(day.slice(0, 7)))
        throw new Error('本自然月已使用试卷跳过');
      months.add(day.slice(0, 7));
    }
  }
}
export async function lockSubject(db: Connection, subjectId: string) {
  const user = await db.user.findUnique({ where: { id: subjectId } });
  if (!user?.active) throw new Error('奖惩对象不存在或已停用');
  await db.$executeRaw`UPDATE "User" SET "revision"="revision" WHERE "id"=${subjectId}`;
}
export async function audit(
  db: Connection,
  actorId: string,
  action: string,
  objectId: string,
  detail: unknown,
) {
  await db.audit.create({ data: { actorId, action, objectId, detail: JSON.stringify(detail) } });
}
