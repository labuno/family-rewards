import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpenCheck,
  HeartHandshake,
  Sparkles,
  CornerUpLeft,
  CircleCheck,
  Clock3,
} from 'lucide-react';
import { EVENT_LABELS, type Rules } from '../domain/rules';
import { eventImpact } from '../domain/event-impact';
import type { Asset } from '../domain/assets';
import type { History } from '../services/state';
import { dateTime } from '../server/view';
import { Empty } from './shell';
import { Impact } from './impact';
export const statusLabel = (status: string) =>
  ({ CONFIRMED: '已确认', PENDING: '待确认', DISPUTED: '待沟通', REVERSED: '已反向抵销' })[
    status
  ] ?? status;
export function EventList({
  events,
  history,
  rules,
  asset,
}: {
  events: History;
  history: History;
  rules: Rules;
  asset?: Asset;
}) {
  if (!events.length)
    return (
      <Empty
        title="第一笔成长，等你记录"
        description="一次努力、一份进步，或者一个需要一起面对的小问题。"
      />
    );
  return (
    <div className="event-list">
      <div className="event-list-heading" aria-hidden="true">
        <span>时间</span>
        <span>事项</span>
        <span>预计增减</span>
        <span>确认状态</span>
      </div>
      {events.map((e) => {
        const change = eventImpact(e, rules, history);
        const Icon = e.reverseOf
          ? CornerUpLeft
          : ['CHORE', 'DICTATION', 'SKIP'].includes(e.type)
            ? Sparkles
            : ['CRY', 'SHOUT'].includes(e.type)
              ? HeartHandshake
              : BookOpenCheck;
        return (
          <Link className="event-row" key={e.id} href={'/events/' + e.id}>
            <time className="event-time" dateTime={e.occurredAt.toISOString()}>
              {dateTime(e.occurredAt)}
            </time>
            <span
              className={
                'round-icon ' +
                (e.reverseOf ? 'neutral' : ['CRY', 'SHOUT'].includes(e.type) ? 'peach' : 'sage')
              }
            >
              <Icon size={19} />
            </span>
            <div className="event-main">
              <strong>{e.reason}</strong>
              <span>
                {e.typeName ?? EVENT_LABELS[e.type] ?? e.type} · {e.quantity} 次 <i /> {e.actorName}{' '}
                记录
              </span>
            </div>
            <div className="event-change">
              <Impact
                money={asset === 'POINTS' ? 0 : change.money}
                points={asset === 'MONEY' ? 0 : change.points}
              />
            </div>
            <div className="event-meta">
              <span className={'status status-' + e.status.toLowerCase()}>
                {e.status === 'CONFIRMED' ? <CircleCheck size={12} /> : <Clock3 size={12} />}{' '}
                {statusLabel(e.status)}
              </span>
              <small>{e.actorName} 记录</small>
            </div>
            <ArrowUpRight size={16} className="event-arrow" />
          </Link>
        );
      })}
      <p className="event-list-note">
        按协议列出单笔增减，尚未计入月度封顶及整月奖励；待确认事项不计入本月净额，已抵销事项与反向记录相互抵销。
      </p>
    </div>
  );
}
