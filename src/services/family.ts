import { z } from 'zod';
import type { Database } from '../server/db';
import { authorize, requireAdmin, type Actor } from '../server/permissions';
import { localDay, localMonth, parseDay } from '../domain/periods';
import { calculate, effectiveFacts, rate, DEFAULT_RULES } from '../domain/rules';
import {
  audit,
  lockSubject,
  readHistory,
  confirmedFacts,
  validateLimits,
  type Connection,
} from './state';
import {
  getPeriod,
  makeSnapshot,
  validateSummary,
  summaryConfirmation,
  type Snapshot,
} from './summary';
import { currentRules, hashRules } from '../server/record-types';
const inputSchema = z.object({
  subjectId: z.string().min(1),
  type: z.string().regex(/^[A-Z][A-Z0-9_]{0,80}$/),
  occurredAt: z.date(),
  quantity: z.number().int().min(1).max(1000),
  reason: z.string().trim().min(1).max(1000),
  evidence: z.string().max(500),
  source: z.string().trim().min(1).max(200),
  requestKey: z.string().min(1).max(100),
});
export type RecordInput = z.input<typeof inputSchema>;
export class Family {
  constructor(
    private db: Database,
    private now = () => new Date(),
  ) {}
  async history(actor: Actor, subjectId: string) {
    authorize(actor, subjectId);
    return readHistory(this.db, subjectId);
  }
  private async write<T>(subjectId: string, fn: (tx: Connection) => Promise<T>) {
    return this.db.$transaction(
      async (tx) => {
        await lockSubject(tx, subjectId);
        return fn(tx);
      },
      { timeout: 10000 },
    );
  }
  async record(actor: Actor, input: RecordInput) {
    const data = inputSchema.parse(input);
    authorize(actor, data.subjectId);
    if (data.occurredAt > this.now()) throw new Error('不能登记未来事件');
    if (['CHORE', 'SKIP'].includes(data.type) && data.quantity !== 1)
      throw new Error('该事项每次只能登记一次');
    return this.write(data.subjectId, async (tx) => {
      const previous = await tx.event.findUnique({ where: { requestKey: data.requestKey } });
      if (previous) {
        if (previous.deletedAt) throw new Error('该记录已删除，请重新登记');
        if (
          previous.actorId !== actor.id ||
          previous.subjectId !== data.subjectId ||
          previous.type !== data.type ||
          previous.reason !== data.reason ||
          previous.occurredAt.getTime() !== data.occurredAt.getTime() ||
          previous.quantity !== data.quantity ||
          previous.evidence !== data.evidence ||
          previous.source !== data.source
        )
          throw new Error('重复提交标识对应其他内容');
        return previous;
      }
      const active = await currentRules(tx);
      rate(data.type, data.evidence, active.rules);
      const period = await getPeriod(tx, data.occurredAt);
      if (
        await tx.settlement.findFirst({
          where: { subjectId: data.subjectId, periodStart: period.start, postedAt: { not: null } },
        })
      )
        throw new Error('该协议月已结算，请使用反向记录更正');
      const existing = await tx.event.findFirst({
        where: {
          subjectId: data.subjectId,
          type: data.type,
          source: data.source,
          reverseOf: null,
          deletedAt: null,
        },
      });
      if (existing) throw new Error('同一来源事项已登记');
      if (data.type === 'SKIP') await this.checkSkip(tx, data.subjectId, data.occurredAt);
      const event = await tx.event.create({
        data: { ...data, periodStart: period.start, actorId: actor.id },
      });
      await tx.user.update({ where: { id: data.subjectId }, data: { revision: { increment: 1 } } });
      await audit(tx, actor.id, 'EVENT_CREATED', event.id, {
        type: data.type,
        subjectId: data.subjectId,
      });
      return event;
    });
  }
  private async checkSkip(tx: Connection, subjectId: string, at: Date, exclude?: string) {
    const history = await readHistory(tx, subjectId);
    const effective = effectiveFacts(confirmedFacts(history)).filter((f) => f.id !== exclude);
    if (effective.some((f) => f.type === 'SKIP' && localMonth(f.occurredAt) === localMonth(at)))
      throw new Error('本自然月已使用试卷跳过');
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { subjectId } });
    const posted = await tx.settlement.findMany({
      where: { subjectId, postedAt: { not: null } },
      select: { periodStart: true },
    });
    const periods = new Set(posted.map((p) => p.periodStart));
    const unpaid = effective
      .filter(
        (f) => f.type === 'SKIP' && !periods.has(history.find((e) => e.id === f.id)!.periodStart),
      )
      .reduce((n, f) => n + f.quantity * 10, 0);
    if (wallet.points - unpaid < 10)
      throw new Error('已结算积分不足 10 分；本月未结算积分不能使用');
  }
  async decide(actor: Actor, id: string, decision: string, requestKey: string, reason = '') {
    if (!['CONFIRM', 'DISPUTE'].includes(decision)) throw new Error('确认意见无效');
    if (decision === 'DISPUTE' && !reason.trim()) throw new Error('请填写异议原因');
    const event = await this.db.event.findUniqueOrThrow({ where: { id } });
    authorize(actor, event.subjectId);
    return this.write(event.subjectId, async (tx) => {
      await this.requireActiveEvent(tx, id);
      const repeat = await tx.eventDecision.findUnique({ where: { requestKey } });
      if (repeat) {
        if (repeat.actorId !== actor.id || repeat.eventId !== id || repeat.decision !== decision)
          throw new Error('提交标识冲突');
        return;
      }
      if (
        await tx.settlement.findFirst({
          where: {
            subjectId: event.subjectId,
            periodStart: event.periodStart,
            postedAt: { not: null },
          },
        })
      )
        throw new Error('已结算事实不可改动，请追加反向记录');
      if (decision === 'DISPUTE') {
        const current = (await readHistory(tx, event.subjectId)).find((e) => e.id === id)!;
        if (['CONFIRMED', 'REVERSED'].includes(current.status))
          throw new Error('已确认记录不能再标记待沟通，请通过反向记录更正');
      }
      const own = await tx.eventDecision.findFirst({
        where: { eventId: id, actorId: actor.id },
        orderBy: { createdAt: 'desc' },
      });
      if (decision === 'CONFIRM' && (own ? own.decision === 'CONFIRM' : event.actorId === actor.id))
        return;
      const last = await tx.eventDecision.findFirst({
        where: { eventId: id },
        orderBy: { createdAt: 'desc' },
      });
      await tx.eventDecision.create({
        data: {
          eventId: id,
          actorId: actor.id,
          decision,
          reason,
          requestKey,
          createdAt: new Date(Math.max(Date.now(), (last?.createdAt.getTime() ?? 0) + 1)),
        },
      });
      const history = await readHistory(tx, event.subjectId);
      const status = history.find((e) => e.id === id)!.status;
      if (status === 'CONFIRMED') {
        if (event.type === 'SKIP') await this.checkSkip(tx, event.subjectId, event.occurredAt, id);
        validateLimits(history);
      }
      await tx.user.update({
        where: { id: event.subjectId },
        data: { revision: { increment: 1 } },
      });
      await audit(tx, actor.id, 'EVENT_' + decision, id, { reason });
    });
  }
  async reverse(actor: Actor, id: string, reason: string, requestKey: string) {
    const original = await this.db.event.findUniqueOrThrow({ where: { id } });
    authorize(actor, original.subjectId);
    if (!reason.trim() || original.reverseOf) throw new Error('请填写原因；反向记录不能再次反向');
    return this.write(original.subjectId, async (tx) => {
      await this.requireActiveEvent(tx, id);
      const repeat = await tx.event.findUnique({ where: { requestKey } });
      if (repeat) {
        if (repeat.deletedAt) throw new Error('该反向记录已删除，请重新提交');
        if (repeat.actorId !== actor.id || repeat.reverseOf !== id) throw new Error('提交标识冲突');
        return repeat;
      }
      const sum = await tx.event.aggregate({
        where: { reverseOf: id, deletedAt: null },
        _sum: { quantity: true },
      });
      if ((sum._sum.quantity ?? 0) >= original.quantity)
        throw new Error('反向次数超过原记录，不能重复冲回');
      const period = await getPeriod(tx, this.now());
      const originalPeriodPosted = await tx.settlement.findFirst({
        where: {
          subjectId: original.subjectId,
          periodStart: original.periodStart,
          postedAt: { not: null },
        },
      });
      const event = await tx.event.create({
        data: {
          subjectId: original.subjectId,
          periodStart: originalPeriodPosted ? period.start : original.periodStart,
          type: 'REVERSAL',
          occurredAt: this.now(),
          quantity: original.quantity - (sum._sum.quantity ?? 0),
          reason,
          evidence: '{}',
          source: original.id,
          reverseOf: id,
          actorId: actor.id,
          requestKey,
        },
      });
      await tx.user.update({
        where: { id: original.subjectId },
        data: { revision: { increment: 1 } },
      });
      await audit(tx, actor.id, 'REVERSAL_CREATED', event.id, { original: id, reason });
      return event;
    });
  }
  private async requireActiveEvent(tx: Connection, id: string) {
    const event = await tx.event.findUniqueOrThrow({ where: { id } });
    if (event.deletedAt) throw new Error('该记录已删除');
    return event;
  }
  async remove(actor: Actor, id: string) {
    const original = await this.db.event.findUniqueOrThrow({ where: { id } });
    authorize(actor, original.subjectId);
    if (original.actorId !== actor.id) throw new Error('只有创建人可以删除记录');
    return this.write(original.subjectId, async (tx) => {
      const event = await tx.event.findUniqueOrThrow({ where: { id } });
      if (event.deletedAt) return;
      await this.checkDelete(tx, event);
      await tx.event.update({
        where: { id },
        data: { deletedAt: this.now(), deletedBy: actor.id },
      });
      await tx.user.update({
        where: { id: event.subjectId },
        data: { revision: { increment: 1 } },
      });
      await audit(tx, actor.id, 'EVENT_DELETED', id, {
        subjectId: event.subjectId,
        reverseOf: event.reverseOf,
      });
    });
  }
  private async checkDelete(
    tx: Connection,
    event: { id: string; actorId: string; subjectId: string; periodStart: string },
  ) {
    const confirmed = await tx.eventDecision.findFirst({
      where: { eventId: event.id, actorId: { not: event.actorId }, decision: 'CONFIRM' },
    });
    if (confirmed) throw new Error('已有其他成员确认，不能删除，请追加反向记录更正');
    const posted = await tx.settlement.findFirst({
      where: {
        subjectId: event.subjectId,
        periodStart: event.periodStart,
        postedAt: { not: null },
      },
    });
    if (posted) throw new Error('已结算记录不能删除');
    const reversal = await tx.event.findFirst({ where: { reverseOf: event.id, deletedAt: null } });
    if (reversal) throw new Error('请先处理这条记录关联的反向记录');
  }
  async generate(actor: Actor, subjectId: string, start: string) {
    requireAdmin(actor);
    authorize(actor, subjectId);
    parseDay(start);
    return this.write(subjectId, async (tx) => {
      const period = await getPeriod(tx, parseDay(start));
      if (period.start !== start) throw new Error('不是协议月起点');
      if (parseDay(period.end) > this.now()) throw new Error('协议月尚未结束');
      const posted = await tx.settlement.findFirst({
        where: { subjectId, periodStart: start, postedAt: { not: null } },
      });
      if (posted) return posted;
      const history = await readHistory(tx, subjectId);
      if (
        history.some((e) => e.periodStart <= start && !['CONFIRMED', 'REVERSED'].includes(e.status))
      )
        throw new Error('有未确认或有异议记录，请先在月底页面处理');
      const user = await tx.user.findUniqueOrThrow({ where: { id: subjectId } });
      const snapshot = await makeSnapshot(tx, subjectId, start, history);
      const rulesKey = hashRules(snapshot.rules);
      const previous = await tx.settlement.findUnique({
        where: {
          subjectId_periodStart_revision_rulesKey: {
            subjectId,
            periodStart: start,
            revision: user.revision,
            rulesKey,
          },
        },
      });
      if (previous) return previous;
      const s = await tx.settlement.create({
        data: {
          subjectId,
          periodStart: start,
          periodEnd: period.end,
          revision: user.revision,
          rulesKey,
          snapshot: JSON.stringify(snapshot),
          actorId: actor.id,
        },
      });
      await audit(tx, actor.id, 'SUMMARY_CREATED', s.id, { period: start });
      return s;
    });
  }
  async confirmSummary(actor: Actor, id: string) {
    const original = await this.db.settlement.findUniqueOrThrow({ where: { id } });
    authorize(actor, original.subjectId);
    return this.write(original.subjectId, async (tx) => {
      const s = await validateSummary(tx, id);
      if (s.postedAt || actor.id === s.actorId) return;
      const snapshot = JSON.parse(s.snapshot) as Snapshot;
      if (!snapshot.participants.some((p) => p.id === actor.id))
        throw new Error('不在总结确认人中');
      const previous = await tx.settlementDecision.findUnique({
        where: { settlementId_actorId: { settlementId: id, actorId: actor.id } },
      });
      if (previous) return;
      await tx.settlementDecision.create({ data: { settlementId: id, actorId: actor.id } });
      await audit(tx, actor.id, 'SUMMARY_CONFIRMED', id, {});
    });
  }
  async post(actor: Actor, id: string) {
    requireAdmin(actor);
    const original = await this.db.settlement.findUniqueOrThrow({ where: { id } });
    return this.write(original.subjectId, async (tx) => {
      const s = await validateSummary(tx, id);
      if (s.postedAt) return s;
      if (parseDay(s.periodEnd) > this.now()) throw new Error('协议月尚未结束');
      const snapshot = JSON.parse(s.snapshot) as Snapshot;
      const decisions = await tx.settlementDecision.findMany({ where: { settlementId: id } });
      if (summaryConfirmation(s, decisions).status !== 'CONFIRMED')
        throw new Error('请对象本人及任意一位管理员确认总结后再入账');
      if (
        await tx.settlement.findFirst({
          where: { subjectId: s.subjectId, periodStart: s.periodStart, postedAt: { not: null } },
        })
      )
        throw new Error('该周期已经入账');
      const before = await tx.wallet.findUniqueOrThrow({ where: { subjectId: s.subjectId } });
      for (const [asset, old, delta] of [
        ['MONEY', before.money, snapshot.moneyTotal],
        ['POINTS', before.points, snapshot.pointsTotal],
      ] as const)
        await tx.walletEntry.create({
          data: {
            subjectId: s.subjectId,
            asset,
            before: old,
            delta,
            after: old + delta,
            settlementId: id,
            actorId: actor.id,
          },
        });
      await tx.wallet.update({
        where: { subjectId: s.subjectId },
        data: {
          money: { increment: snapshot.moneyTotal },
          points: { increment: snapshot.pointsTotal },
        },
      });
      await tx.user.update({ where: { id: s.subjectId }, data: { revision: { increment: 1 } } });
      const posted = await tx.settlement.update({
        where: { id },
        data: { postedAt: this.now(), postedBy: actor.id },
      });
      await audit(tx, actor.id, 'SUMMARY_POSTED', id, {
        money: snapshot.moneyTotal,
        points: snapshot.pointsTotal,
      });
      return posted;
    });
  }
}
