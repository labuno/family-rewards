import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, CornerUpLeft, MessageCircle, Trash2 } from 'lucide-react';
import { requireUser } from '../../../../server/session';
import { database } from '../../../../server/db';
import { Family } from '../../../../services/family';
import { EVENT_LABELS } from '../../../../domain/rules';
import { dateTime } from '../../../../server/view';
import { PageHeading } from '../../../../components/shell';
import { statusLabel } from '../../../../components/event-list';
import { CommandForm } from '../../../../components/command-form';
import { Button } from '../../../../components/ui/button';
export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    actor = await requireUser(),
    db = database();
  const raw = await db.event.findUnique({ where: { id } });
  if (!raw || raw.deletedAt) notFound();
  const history = await new Family(db).history(actor, raw.subjectId),
    e = history.find((e) => e.id === id)!;
  const evidence = JSON.parse(e.evidence);
  const original = e.reverseOf ? history.find((o) => o.id === e.reverseOf) : null;
  const otherConfirmed = e.decisions.some(
    (d) => d.actorId !== e.actorId && d.decision === 'CONFIRM',
  );
  const hasReversal = history.some((r) => r.reverseOf === e.id);
  const posted = await db.settlement.findFirst({
    where: { subjectId: e.subjectId, periodStart: e.periodStart, postedAt: { not: null } },
  });
  return (
    <>
      <Link className="back-link" href={'/history?subject=' + e.subjectId}>
        <ArrowLeft size={16} />
        全部记录
      </Link>
      <PageHeading
        eyebrow="一件小事，一起认真对待"
        title={e.typeName ?? EVENT_LABELS[e.type] ?? e.type}
        description={e.subjectName + ' 的成长记录'}
      />
      <div className="detail-grid">
        <section className="panel detail-panel">
          <span className="pill">{e.reverseOf ? '反向记录' : '普通记录'}</span>{' '}
          <span className={'status status-' + e.status.toLowerCase()}>{statusLabel(e.status)}</span>
          <h2 className="detail-reason">{e.reason}</h2>
          {original && (
            <div className="notice">
              <p>这条记录用于抵销原始事项，不是一笔独立奖惩。</p>
              <p>
                原事项：{original.typeName ?? EVENT_LABELS[original.type] ?? original.type} ·
                本次抵销 {e.quantity} 次
              </p>
              <Link className="text-link" href={'/events/' + original.id}>
                {original.reason}
              </Link>
            </div>
          )}
          <dl className="detail-list">
            {original && (
              <div>
                <dt>原事项类型</dt>
                <dd>{original.typeName ?? EVENT_LABELS[original.type] ?? original.type}</dd>
              </div>
            )}
            <div>
              <dt>奖惩对象</dt>
              <dd>{e.subjectName}</dd>
            </div>
            <div>
              <dt>发生时间</dt>
              <dd>{dateTime(e.occurredAt)}（北京时间）</dd>
            </div>
            <div>
              <dt>事项次数</dt>
              <dd>{e.quantity} 次</dd>
            </div>
            {evidence.shoutTarget && (
              <div>
                <dt>对象</dt>
                <dd>{evidence.shoutTarget}</dd>
              </div>
            )}
            {evidence.schoolYear && (
              <div>
                <dt>年级</dt>
                <dd>{evidence.schoolYear}</dd>
              </div>
            )}
            {(original || e.source !== e.requestKey) && (
              <div>
                <dt>{e.reverseOf ? '原记录来源 / 依据' : '来源 / 依据'}</dt>
                <dd>
                  {original
                    ? original.source === original.requestKey
                      ? '详见原始记录'
                      : original.source
                    : e.source}
                </dd>
              </div>
            )}
            {evidence.grade && (
              <div>
                <dt>成绩等级</dt>
                <dd>{evidence.grade}</dd>
              </div>
            )}
            {evidence.score !== undefined && (
              <div>
                <dt>试卷分数</dt>
                <dd>{evidence.score}</dd>
              </div>
            )}
            <div>
              <dt>录入人</dt>
              <dd>{e.actorName}</dd>
            </div>
            <div>
              <dt>录入时间</dt>
              <dd>{dateTime(e.createdAt)}</dd>
            </div>
            <div>
              <dt>已确认成员</dt>
              <dd>{e.confirmedBy.join('、') || '等待确认'}</dd>
            </div>
            {e.reverseOf && (
              <div>
                <dt>原始记录</dt>
                <dd>
                  <Link className="text-link" href={'/events/' + e.reverseOf}>
                    查看被更正的记录
                  </Link>
                </dd>
              </div>
            )}
          </dl>
          {!posted && !e.confirmedIds.includes(actor.id) && (
            <CommandForm>
              <input type="hidden" name="action" value="decide" />
              <input type="hidden" name="eventId" value={id} />
              <input type="hidden" name="decision" value="CONFIRM" />
              <input type="hidden" name="requestKey" value={randomUUID()} />
              <Button>
                <Check size={17} />
                确认这条记录
              </Button>
            </CommandForm>
          )}
          {posted && (
            <p className="notice">本协议月已结算。发现错误请追加反向记录，原数据始终保留。</p>
          )}
        </section>
        <aside className="detail-side">
          {!posted && ['PENDING', 'DISPUTED'].includes(e.status) && (
            <section className="panel detail-panel">
              <h3>
                <MessageCircle size={18} />
                有需要再聊聊的地方？
              </h3>
              <CommandForm>
                <input type="hidden" name="action" value="decide" />
                <input type="hidden" name="eventId" value={id} />
                <input type="hidden" name="decision" value="DISPUTE" />
                <input type="hidden" name="requestKey" value={randomUUID()} />
                <label htmlFor="dispute">需要沟通的原因</label>
                <textarea id="dispute" name="reason" rows={3} required maxLength={1000} />
                <Button variant="outline">标记待沟通</Button>
              </CommandForm>
            </section>
          )}
          {!posted && actor.id === e.actorId && !otherConfirmed && !hasReversal && (
            <section className="panel detail-panel">
              <h3>
                <Trash2 size={18} />
                删除未确认记录
              </h3>
              <p className="muted small">
                其他成员尚未确认，创建人可以删除。删除后不参与列表及结算，并保留删除操作记录。
              </p>
              <CommandForm>
                <input type="hidden" name="action" value="delete-event" />
                <input type="hidden" name="eventId" value={id} />
                <Button variant="outline">删除未确认记录</Button>
              </CommandForm>
            </section>
          )}
          {!e.reverseOf && e.status !== 'REVERSED' && (
            <section className="panel detail-panel">
              <h3>
                <CornerUpLeft size={18} />
                需要纠正这条记录？
              </h3>
              <p className="muted small">追加反向记录抵销原事项，不删除原始记录。</p>
              <CommandForm>
                <input type="hidden" name="action" value="reverse" />
                <input type="hidden" name="eventId" value={id} />
                <input type="hidden" name="requestKey" value={randomUUID()} />
                <label htmlFor="reverseReason">更正原因</label>
                <textarea id="reverseReason" name="reason" required rows={3} maxLength={1000} />
                <Button variant="outline">新增反向记录</Button>
              </CommandForm>
            </section>
          )}
        </aside>
      </div>
      <section className="panel records-panel">
        <div className="section-heading">
          <h2>确认与操作时间线</h2>
        </div>
        <div className="timeline">
          <div>
            <span className="timeline-dot" />
            <strong>{e.actorName} 创建记录（创建即确认）</strong>
            <p>{dateTime(e.createdAt)}</p>
          </div>
          {e.decisions.map((d) => (
            <div key={d.id}>
              <span className="timeline-dot" />
              <strong>
                {d.name} · {d.decision === 'CONFIRM' ? '确认' : '提出异议'}
              </strong>
              <p>{dateTime(d.createdAt)}</p>
              {d.reason && (
                <p>
                  {d.decision === 'DISPUTE' ? '沟通原因：' : '说明：'}
                  {d.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
