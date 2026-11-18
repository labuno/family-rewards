import { NextResponse } from 'next/server';
import { z } from 'zod';
import { browserSession } from '../../../server/session';
import { Accounts } from '../../../server/accounts';
import { database } from '../../../server/db';
import { RecordTypes } from '../../../server/record-types';
import { parseMoney } from '../../../domain/money';
import { SHOUT_TARGETS } from '../../../domain/rules';
import { Family, type RecordInput } from '../../../services/family';
export const runtime = 'nodejs';
function field(form: FormData, key: string) {
  const val = form.get(key);
  return typeof val === 'string' ? val : '';
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const allowed = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  if (origin !== allowed) return NextResponse.json({ error: '请求来源无效' }, { status: 403 });
  try {
    const form = await request.formData(),
      action = field(form, 'action');
    const db = database(),
      accounts = new Accounts(db),
      family = new Family(db),
      session = await browserSession();
    if (action === 'login') {
      const result = await accounts.login(field(form, 'username'), field(form, 'password'));
      session.token = result.token;
      await session.save();
      return NextResponse.json({ redirect: '/' });
    }
    const actor = session.token ? await accounts.resolve(session.token) : null;
    if (!actor) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (action === 'logout') {
      await accounts.logout(session.token!);
      session.destroy();
      return NextResponse.json({ redirect: '/login' });
    }
    const subjectId = field(form, 'subjectId') || actor.id;
    const base = '?subject=' + encodeURIComponent(subjectId);
    if (action === 'create-type') {
      await new RecordTypes(db).create(actor, {
        name: field(form, 'name'),
        money: parseMoney(field(form, 'money')),
        points: Number(field(form, 'points')),
      });
      return NextResponse.json({ redirect: '/record-types' });
    }
    if (action === 'setup') {
      await accounts.setup(actor, field(form, 'anchor'));
      return NextResponse.json({ redirect: '/' });
    }
    if (action === 'record') {
      const type = field(form, 'type');
      const result =
        type === 'SCHOOL'
          ? { grade: field(form, 'grade') }
          : ['BASIC', 'ADVANCED'].includes(type)
            ? { score: Number(field(form, 'score')) }
            : {};
      const evidence =
        type === 'SHOUT'
          ? {
              shoutTarget: z
                .enum(SHOUT_TARGETS, { error: '请选择有效对象' })
                .parse(field(form, 'shoutTarget')),
            }
          : ['SCHOOL', 'BASIC', 'ADVANCED'].includes(type)
            ? { ...result, schoolYear: z.string().trim().max(30).parse(field(form, 'schoolYear')) }
            : result;
      const event = await family.record(actor, {
        subjectId,
        type,
        occurredAt: new Date(field(form, 'occurredAt') + ':00+08:00'),
        quantity: Number(field(form, 'quantity') || 1),
        reason: field(form, 'reason'),
        source: field(form, 'source') || field(form, 'requestKey'),
        evidence: JSON.stringify(evidence),
        requestKey: field(form, 'requestKey'),
      } as RecordInput);
      return NextResponse.json({ redirect: '/events/' + event.id });
    }
    if (action === 'decide') {
      await family.decide(
        actor,
        field(form, 'eventId'),
        field(form, 'decision'),
        field(form, 'requestKey'),
        field(form, 'reason'),
      );
      return NextResponse.json({});
    }
    if (action === 'delete-event') {
      await family.remove(actor, field(form, 'eventId'));
      return NextResponse.json({ redirect: '/history' });
    }
    if (action === 'reverse') {
      const event = await family.reverse(
        actor,
        field(form, 'eventId'),
        field(form, 'reason'),
        field(form, 'requestKey'),
      );
      return NextResponse.json({ redirect: '/events/' + event.id });
    }
    if (action === 'generate') {
      const summary = await family.generate(actor, subjectId, field(form, 'start'));
      return NextResponse.json({ redirect: '/settlements/' + summary.id });
    }
    if (action === 'confirm-summary') {
      await family.confirmSummary(actor, field(form, 'id'));
      return NextResponse.json({});
    }
    if (action === 'post') {
      await family.post(actor, field(form, 'id'));
      return NextResponse.json({});
    }
    return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
  } catch (e) {
    const message =
      e instanceof z.ZodError
        ? '请检查必填项、时间和次数'
        : e instanceof Error
          ? e.message
          : '操作失败';
    const safe =
      /Prisma|SQLITE|Unique constraint|Invalid.*invocation|database.*locked|timed out/i.test(
        message,
      )
        ? '保存发生冲突或服务暂忙，请刷新后重试'
        : message;
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
