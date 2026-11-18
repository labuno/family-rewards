import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, ShieldCheck, CircleCheck, Clock3 } from 'lucide-react';
import { requireUser } from '../../../../server/session';
import { database } from '../../../../server/db';
import { authorize } from '../../../../server/permissions';
import { summaryConfirmation, type Snapshot } from '../../../../services/summary';
import { currentRules } from '../../../../server/record-types';
import { money, dateTime } from '../../../../server/view';
import { EVENT_LABELS } from '../../../../domain/rules';
import { PageHeading } from '../../../../components/shell';
import { CommandForm } from '../../../../components/command-form';
import { Button } from '../../../../components/ui/button';
export default async function Summary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    actor = await requireUser(),
    db = database();
  const s = await db.settlement.findUnique({ where: { id } });
  if (!s) notFound();
  authorize(actor, s.subjectId);
  const subject = await db.user.findUniqueOrThrow({ where: { id: s.subjectId } }),
    snapshot = JSON.parse(s.snapshot) as Snapshot;
  const { key: rulesKey } = await currentRules(db);
  const approvals = await db.settlementDecision.findMany({ where: { settlementId: id } }),
    stale = !s.postedAt && (s.revision !== subject.revision || s.rulesKey !== rulesKey),
    sum = snapshot.summary;
  const confirmation = summaryConfirmation(s, approvals);
  const wallet = await db.wallet.findUniqueOrThrow({ where: { subjectId: s.subjectId } });
  return (
    <>
      <Link href={'/settlements?subject=' + s.subjectId} className="back-link">
        <ArrowLeft size={16} />
        全部月度总结
      </Link>
      <PageHeading
        eyebrow="一个月的努力，一起核对"
        title="一起核对这个月"
        description={`${subject.name} · ${s.periodStart} 至 ${s.periodEnd}（不含结束日）`}
      />
      {stale && (
        <p role="alert" className="notice warning">
          事实或规则已变化。请返回月度总结页面重新生成，旧确认不能用于新结果。
        </p>
      )}
      <div className="summary-hero">
        <div>
          <span className="pill">{s.postedAt ? '已入账' : '等待共同确认'}</span>
          <h2>{s.postedAt ? '这个月的成长，已认真存好。' : '认真核对，再把成长存起来。'}</h2>
          <p>
            生成时有效学习哭泣 {sum.cryCount} 次 ·{' '}
            {sum.cryCount === 0 ? '符合无哭泣月度奖励候选' : '本月不计无哭泣奖励'}
          </p>
        </div>
        <ShieldCheck size={62} />
      </div>
      <div className="two-columns">
        <section className="panel detail-panel">
          <h2>金钱结算</h2>
          <dl className="detail-list">
            <div>
              <dt>原始奖励合计</dt>
              <dd>{money(sum.rawReward)}</dd>
            </div>
            <div>
              <dt>无学习哭泣奖励</dt>
              <dd>{money(sum.monthlyBonus)}</dd>
            </div>
            <div>
              <dt>奖励封顶后</dt>
              <dd>{money(sum.reward)}</dd>
            </div>
            <div>
              <dt>原始扣减合计</dt>
              <dd>{money(sum.rawDeduction)}</dd>
            </div>
            <div>
              <dt>扣减封顶后</dt>
              <dd>{money(sum.deduction)}</dd>
            </div>
            <div className="total-line">
              <dt>本周期净变化</dt>
              <dd>{money(sum.moneyDelta)}</dd>
            </div>
          </dl>
          <p className="form-hint">奖励与扣减各封顶 ¥1,000；原始记录不变。</p>
        </section>
        <section className="panel detail-panel">
          <h2>积分与钱包</h2>
          <dl className="detail-list">
            <div>
              <dt>本周期积分变化</dt>
              <dd>{sum.pointsDelta} 积分币</dd>
            </div>
            <div>
              <dt>历史更正调整</dt>
              <dd>{snapshot.adjustments.length} 项</dd>
            </div>
            <div>
              <dt>本次金钱总变化</dt>
              <dd>{money(snapshot.moneyTotal)}</dd>
            </div>
            <div>
              <dt>本次积分总变化</dt>
              <dd>{snapshot.pointsTotal}</dd>
            </div>
            {!s.postedAt && (
              <>
                <div>
                  <dt>预计金钱余额</dt>
                  <dd>{money(wallet.money + snapshot.moneyTotal)}</dd>
                </div>
                <div>
                  <dt>预计积分余额</dt>
                  <dd>{wallet.points + snapshot.pointsTotal}</dd>
                </div>
              </>
            )}
          </dl>
        </section>
      </div>
      <section className="panel records-panel">
        <div className="section-heading">
          <h2>事项次数与更正</h2>
        </div>
        <div className="count-grid">
          {Object.entries(sum.counts).map(([type, count]) => (
            <div key={type}>
              <span>{EVENT_LABELS[type] ?? snapshot.rules.custom?.[type]?.name ?? type}</span>
              <strong>{count} 次</strong>
            </div>
          ))}
        </div>
        {snapshot.adjustments.map((a) => (
          <p key={a.periodStart} className="notice">
            原协议月 {a.periodStart} 更正差额：{money(a.money)} / {a.points}{' '}
            积分，单列计入本次钱包变化。
          </p>
        ))}
      </section>
      <section className="panel records-panel">
        <div className="section-heading">
          <h2>共同确认</h2>
          <span className="status status-pending">
            {confirmation.status === 'CONFIRMED' ? '双方已确认' : '等待另一方确认'}
          </span>
        </div>
        <div className="confirmations">
          {snapshot.participants.map((p) => {
            const approval = approvals.find((a) => a.actorId === p.id);
            const isCreator = p.id === s.actorId;
            const confirmed = confirmation.approvedIds.includes(p.id);
            return (
              <div key={p.id}>
                <span className="avatar">{p.name.slice(0, 1)}</span>
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {isCreator
                      ? `创建即确认 · ${dateTime(s.createdAt)}`
                      : approval
                        ? dateTime(approval.createdAt)
                        : p.id === s.subjectId
                          ? '等待本人确认'
                          : '管理员任一人确认即可'}
                  </small>
                </div>
                {confirmed ? (
                  <CircleCheck size={21} className="positive" />
                ) : (
                  <Clock3 size={21} className="muted" />
                )}
              </div>
            );
          })}
        </div>
        {!s.postedAt && !stale && (
          <div className="summary-actions">
            {!confirmation.approvedIds.includes(actor.id) && (
              <CommandForm>
                <input type="hidden" name="action" value="confirm-summary" />
                <input type="hidden" name="id" value={id} />
                <Button>
                  <Check size={18} />
                  确认本月总结
                </Button>
              </CommandForm>
            )}
            {actor.role === 'ADMIN' && (
              <CommandForm>
                <input type="hidden" name="action" value="post" />
                <input type="hidden" name="id" value={id} />
                <Button variant="outline">确认并更新钱包</Button>
              </CommandForm>
            )}
            <p className="muted small">
              创建即确认；对象本人和任意一位管理员确认后即可由管理员入账。
            </p>
          </div>
        )}
        {s.postedAt && (
          <p className="notice">
            已于 {dateTime(s.postedAt)} 入账。原总结与流水不会删除，重复提交不会重复增加余额。
          </p>
        )}
      </section>
    </>
  );
}
