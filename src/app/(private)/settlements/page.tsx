import Link from 'next/link';
import { CalendarCheck2, ArrowUpRight } from 'lucide-react';
import { view, dateTime, type Search } from '../../../server/view';
import { parseDay, localDay } from '../../../domain/periods';
import { PageHeading, SubjectPicker, Empty } from '../../../components/shell';
import { CommandForm } from '../../../components/command-form';
import { Button } from '../../../components/ui/button';
export default async function Settlements({ searchParams }: { searchParams: Promise<Search> }) {
  const v = await view(await searchParams);
  const summaries = await v.db.settlement.findMany({
    where: { subjectId: v.subject.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const pending = v.events.filter((e) => !['CONFIRMED', 'REVERSED'].includes(e.status));
  return (
    <>
      <PageHeading
        eyebrow="每个月，一起回头看看"
        title="月度总结"
        description="确认事实、听听彼此，再把这个月的成长存进钱包。"
      />
      {v.actor.role === 'ADMIN' && <SubjectPicker users={v.users} current={v.subject.id} />}
      <div className="two-columns">
        <section className="panel form-panel">
          <span className="round-icon sage">
            <CalendarCheck2 size={24} />
          </span>
          <h2>生成月度总结</h2>
          <p className="muted">系统会查询哭泣记录、统计事项次数，并分别计算奖励与扣减上限。</p>
          {v.actor.role === 'ADMIN' ? (
            <CommandForm>
              <input type="hidden" name="action" value="generate" />
              <input type="hidden" name="subjectId" value={v.subject.id} />
              <label htmlFor="start">结算协议月起点</label>
              <input
                id="start"
                name="start"
                type="date"
                defaultValue={
                  v.events.find((e) => e.periodStart < v.period.start)?.periodStart ??
                  v.period.start
                }
                required
              />
              <p className="form-hint">只能结算已经结束的完整协议月。起点需与家庭约定一致。</p>
              <Button>生成月度总结</Button>
            </CommandForm>
          ) : (
            <p className="notice">由管理员生成总结后，你可以在下方打开并确认。</p>
          )}
        </section>
        <section className="panel records-panel">
          <div className="section-heading">
            <h2>确认前的小提醒</h2>
            <span className="count-badge">{pending.length}</span>
          </div>
          <p className="muted">未确认或需要沟通的记录，会在入账前提示大家核对。</p>
          {pending.length ? (
            <div className="pending-list">
              {pending.map((e) => (
                <Link href={'/events/' + e.id} key={e.id}>
                  {e.reason}
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="notice">当前没有未确认记录。一起检查是否有漏记，再确认月度总结。</p>
          )}
        </section>
      </div>
      <section className="panel records-panel">
        <div className="section-heading">
          <h2>历史总结</h2>
          <span className="muted small">事实与规则快照始终保留</span>
        </div>
        {summaries.length ? (
          <div className="summary-list">
            {summaries.map((s) => (
              <Link href={'/settlements/' + s.id} key={s.id}>
                <span className="round-icon neutral">
                  <CalendarCheck2 size={20} />
                </span>
                <div>
                  <strong>
                    {s.periodStart} — {s.periodEnd}
                  </strong>
                  <small>{dateTime(s.createdAt)} 生成</small>
                </div>
                <span className={'status ' + (s.postedAt ? 'status-confirmed' : 'status-pending')}>
                  {s.postedAt ? '已入账' : '待核对'}
                </span>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="还没有月度总结" description="协议月结束后，一起回顾这一个月的努力。" />
        )}
      </section>
    </>
  );
}
