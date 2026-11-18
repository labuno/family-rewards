export const localDay = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期格式错误');
  const date = new Date(value + 'T00:00:00+08:00');
  if (Number.isNaN(date.getTime()) || localDay(date) !== value) throw new Error('日期无效');
  return date;
}
function boundary(anchor: string, offset: number) {
  const [year, month, day] = anchor.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return parseDay(
    `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`,
  );
}
export function periodFor(anchor: string, at: Date) {
  const startDate = parseDay(anchor);
  if (Number.isNaN(at.getTime()) || at < startDate) throw new Error('发生时间早于协议起点或无效');
  const [y, m] = localDay(at).split('-').map(Number);
  const [ay, am] = anchor.split('-').map(Number);
  let offset = (y - ay) * 12 + m - am;
  if (boundary(anchor, offset) > at) offset--;
  return { start: boundary(anchor, offset), end: boundary(anchor, offset + 1) };
}
export const localMonth = (date: Date) => localDay(date).slice(0, 7);
