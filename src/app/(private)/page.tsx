import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  Plus,
  Wallet,
  Star,
  CalendarDays,
  Clock3,
  CheckCheck,
  ClipboardList,
  ChartNoAxesCombined,
} from 'lucide-react';
import { view, money, dateTime, type Search } from '../../server/view';
import { localDay } from '../../domain/periods';
import { PageHeading, SubjectPicker } from '../../components/shell';
import { EventList } from '../../components/event-list';
import { Button } from '../../components/ui/button';

export default async function Dashboard({ searchParams }: { searchParams: Promise<Search> }) {
  const v = await view(await searchParams);
  const query = '?subject=' + v.subject.id;
  const current = v.events.filter((e) => e.periodStart === v.period.start);
  const pending = v.events.filter((e) => !['CONFIRMED', 'REVERSED'].includes(e.status));
  const s = v.preview.records;
  const bonus = v.preview.bonus;
  return (
    <div className="dashboard">
      <PageHeading
        eyebrow="一家人的成长手账"
        title="成长看板"
        description="温暖记录每一天，认真对待每个约定。"
      />
      <div className="dashboard-toolbar">
        {v.actor.role === 'ADMIN' ? (
          <SubjectPicker users={v.users} current={v.subject.id} />
        ) : (
          <div className="subject-label">
            <span className="avatar">{v.subject.name.slice(0, 1)}</span>
            {v.subject.name} 的成长手账
          </div>
        )}
        <Button asChild>
          <Link href={'/events/new' + query}>
            <Plus size={18} />
            记一笔
          </Link>
        </Button>
      </div>
      <div className="period-bar">
        <span>
          <CalendarDays size={16} />
          <span className="period-caption">本协议月</span>
          {v.period.start.replaceAll('-', '.')} — {v.period.end.replaceAll('-', '.')}
        </span>
        <Link href={'/settlements' + query}>
          月度总结 <ArrowRight size={15} />
        </Link>
      </div>
      <section className="wallet-grid" aria-label="已结算钱包">
        <Link href={'/money' + query} className="balance-card balance-money">
          <div className="balance-top">
            <span>
              <Wallet size={20} />
              金钱钱包
            </span>
            <ChevronRight size={17} />
          </div>
          <span className="balance-state">已结算</span>
          <strong className={'balance-number ' + (v.wallet.money < 0 ? 'negative' : '')}>
            {money(v.wallet.money)}
          </strong>
          <p className="balance-foot">
            <span className="status-dot" />
            月度统一结算入账
          </p>
        </Link>
        <Link href={'/points' + query} className="balance-card balance-points">
          <div className="balance-top">
            <span>
              <Star size={20} />
              积分钱包
            </span>
            <ChevronRight size={17} />
          </div>
          <span className="balance-state">已结算</span>
          <strong className="balance-number">
            {v.wallet.points}
            <small>积分</small>
          </strong>
          <p className="balance-foot">
            <span className="status-dot" />
            好习惯，一点点积累
          </p>
        </Link>
      </section>
      <section className="estimate-strip" aria-label="本月预计变化">
        <div className="estimate-label">
          <ChartNoAxesCombined size={20} />
          <span>
            本月预计变化 <small>记录净变化 · 未入账</small>
          </span>
        </div>
        <div className="estimate-values">
          <strong className={s.moneyDelta < 0 ? 'negative' : 'positive'}>
            {s.moneyDelta >= 0 ? '+' : ''}
            {money(s.moneyDelta)}
          </strong>
          <span>/</span>
          <strong className={s.pointsDelta < 0 ? 'negative' : 'positive'}>
            {s.pointsDelta >= 0 ? '+' : ''}
            {s.pointsDelta}
            <small> 积分</small>
          </strong>
        </div>
        <p>
          记录奖励 +{money(s.reward)} · 记录扣减 {s.deduction ? '-' : ''}
          {money(s.deduction)}
        </p>
        <p>
          仅本协议月已确认记录，不含月度奖励及往期调整。
          {v.preview.pendingCount > 0 && `另有 ${v.preview.pendingCount} 条待核对。`}
        </p>
        {v.snapshot.adjustments.length > 0 && (
          <p>
            往期调整另计：
            {money(v.snapshot.adjustments.reduce((n, a) => n + a.money, 0))} /{' '}
            {v.snapshot.adjustments.reduce((n, a) => n + a.points, 0)} 积分，详见月度总结。
          </p>
        )}
      </section>
      <section className="panel bonus-panel" aria-label="完整协议月无学习哭泣">
        <div className="section-heading">
          <div>
            <h2>完整协议月无学习哭泣</h2>
            <p className="muted small">整月奖励候选 +{money(bonus.amount)}</p>
          </div>
          <span
            className={
              'status ' + (bonus.status === 'eligible' ? 'status-confirmed' : 'status-pending')
            }
          >
            {bonus.status === 'blocked'
              ? '本月不满足'
              : bonus.status === 'pending'
                ? '待核对'
                : '目前满足'}
          </span>
        </div>
        <p className="muted small">
          {bonus.status === 'eligible'
            ? '目前没有已确认的有效学习哭泣记录。待完整协议月结束并共同确认后，按协议封顶计入结算。'
            : bonus.status === 'blocked'
              ? '本协议月存在已确认的学习哭泣记录，暂不产生整月奖励。'
              : '有学习哭泣或相关更正记录待核对，确认后更新奖励状态。'}
        </p>
        {(bonus.blockers.length > 0 || bonus.pending.length > 0) && (
          <details className="bonus-reasons">
            <summary>
              {bonus.blockers.length > 0 ? '查看不满足原因' : '查看待核对记录'}{' '}
              <ChevronRight size={14} />
            </summary>
            {[...bonus.blockers, ...bonus.pending].map((e) => (
              <Link key={e.id} href={'/events/' + e.id}>
                <time>
                  {localDay(e.occurredAt)} {dateTime(e.occurredAt).split(' ')[1]}
                </time>
                <span>
                  {e.reason}
                  <small>
                    {e.status === 'CONFIRMED'
                      ? '已确认 · 学习相关哭泣'
                      : '待核对 · ' + (e.reverseOf ? '哭泣记录更正' : '学习相关哭泣')}
                  </small>
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </details>
        )}
      </section>
      <div className="dashboard-sections">
        <section className="panel todo-panel" aria-label="待确认事项">
          <div className="section-heading">
            <h2>
              <Clock3 size={19} />
              待确认事项 <span className="count-badge">{pending.length}</span>
            </h2>
            <span className="muted small">一起核对</span>
          </div>
          {pending.length ? (
            pending.slice(0, 3).map((e) => (
              <Link key={e.id} className="todo-item" href={'/events/' + e.id}>
                <span>
                  <strong>{e.reason}</strong>
                  <small>
                    {e.confirmedIds.includes(v.actor.id) ? '等待另一方确认' : '需要你核对'} ·{' '}
                    {e.actorName} 记录
                  </small>
                </span>
                <span className="todo-action">
                  核对详情 <ChevronRight size={13} />
                </span>
              </Link>
            ))
          ) : (
            <div className="all-done">
              <CheckCheck size={24} />
              <span>
                <strong>记录都核对好啦</strong>
                <small>下一次小小进步，等你记录。</small>
              </span>
            </div>
          )}
          {pending.length > 3 && (
            <Link className="text-link panel-link" href={'/history' + query + '&status=PENDING'}>
              查看待确认记录 <ArrowRight size={15} />
            </Link>
          )}
        </section>
        <section className="panel records-panel dashboard-records" aria-label="本期事实明细">
          <div className="section-heading">
            <h2>
              <ClipboardList size={20} />
              本期事实明细
            </h2>
            <span className="muted small">共 {current.length} 笔记录</span>
          </div>
          <EventList events={current.slice(0, 5)} history={v.events} rules={v.snapshot.rules} />
          <Link
            className="text-link panel-link"
            href={'/history' + query + '&period=' + v.period.start}
          >
            查看全部记录 <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}
