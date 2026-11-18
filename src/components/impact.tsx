import { formatMoney } from '../domain/money';

export function Impact({
  money,
  points,
  zeroLabel = '无变化',
}: {
  money: number;
  points: number;
  zeroLabel?: string;
}) {
  if (!money && !points) return <span className="muted">{zeroLabel}</span>;
  return (
    <span className="impact-values">
      {money !== 0 && (
        <span className={money > 0 ? 'positive' : 'negative'}>
          {money > 0 ? '增加 +' : '扣减 '}
          {formatMoney(money)}
        </span>
      )}
      {points !== 0 && (
        <span className={points > 0 ? 'positive' : 'negative'}>
          {points > 0 ? '增加 +' : '扣减 '}
          {points} 积分
        </span>
      )}
    </span>
  );
}
