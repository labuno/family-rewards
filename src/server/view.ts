import { redirect } from 'next/navigation';
import { database } from './db';
import { requireUser } from './session';
import { authorize } from './permissions';
import { Family } from '../services/family';
import { getPeriod, makeSnapshot, previewPeriod } from '../services/summary';
export type Search = Record<string, string | string[] | undefined>;
export const value = (search: Search, key: string) =>
  typeof search[key] === 'string' ? (search[key] as string) : undefined;
export { formatMoney as money } from '../domain/money';
export const dateTime = (date: Date) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
export async function view(search: Search = {}) {
  const actor = await requireUser(),
    db = database();
  const setting = await db.setting.findUnique({ where: { id: 1 } });
  if (!setting) redirect('/setup');
  const users = await db.user.findMany({
    where: { active: true, ...(actor.role === 'ADMIN' ? {} : { id: actor.id }) },
    select: { id: true, name: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  const subjectId =
    value(search, 'subject') ?? users.find((u) => u.role === 'USER')?.id ?? actor.id;
  if (actor.role !== 'ADMIN' && subjectId !== actor.id) redirect('/access-denied');
  authorize(actor, subjectId);
  const subject = users.find((u) => u.id === subjectId);
  if (!subject) throw new Error('用户不存在');
  const wallet = await db.wallet.findUniqueOrThrow({ where: { subjectId } }),
    events = await new Family(db).history(actor, subjectId);
  const period = await getPeriod(db, new Date());
  const snapshot = await makeSnapshot(db, subjectId, period.start, events);
  const preview = previewPeriod(events, period.start, snapshot.rules);
  return { actor, db, subject, users, wallet, events, period, snapshot, preview };
}
