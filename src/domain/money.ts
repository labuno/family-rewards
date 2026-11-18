export const formatMoney = (cents: number) =>
  `${cents < 0 ? '-' : ''}¥${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function parseMoney(input: string) {
  const match = /^(-?)(\d{1,8})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) throw new Error('金额须为最多两位小数的数字');
  const amount = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return match[1] === '-' ? -amount : amount;
}
