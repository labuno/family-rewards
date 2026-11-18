import Link from 'next/link';
import { Plus, Shapes, ClipboardList, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { requireUser } from '../../../server/session';
import { database } from '../../../server/db';
import { currentRules } from '../../../server/record-types';
import { money, value, type Search } from '../../../server/view';
import { EVENT_LABELS, rate, type Rules } from '../../../domain/rules';
import { PageHeading } from '../../../components/shell';
import { CommandForm } from '../../../components/command-form';
import { Button } from '../../../components/ui/button';

function examRates(code: string, rules: Rules) {
  if (code === 'SCHOOL')
    return Object.entries(rules.school)
      .map(([grade, amount]) => `${grade}：${money(amount)}`)
      .join('；');
  const limits = code === 'BASIC' ? rules.basic : rules.advanced;
  return `≥${limits.high} 分：${money(rules.paperReward)}；${limits.low}–不足 ${limits.high} 分：不奖不扣；低于 ${limits.low} 分：${money(rules.paperDeduction)}`;
}
function presetTypes(rules: Rules) {
  const notes: Record<string, string> = {
    CHORE: '同一天最多奖励一次。',
    SKIP: '每自然月最多一次；只使用已结算积分，至少 10 分。',
  };
  return Object.entries(EVENT_LABELS)
    .filter(([code]) => code !== 'REVERSAL')
    .map(([code, name]) => {
      const exam = ['SCHOOL', 'BASIC', 'ADVANCED'].includes(code);
      const amount = exam ? { money: 0, points: 0 } : rate(code, '{}', rules);
      return {
        code,
        name,
        money: exam ? examRates(code, rules) : money(amount.money),
        points: amount.points,
        note: notes[code] ?? '按实际发生次数登记，月底统一结算。',
        custom: false,
      };
    });
}
function TypeCatalogue({
  types,
  subject,
}: {
  types: ReturnType<typeof presetTypes>;
  subject?: string;
}) {
  return (
    <section aria-label="当前记录类型" className="panel type-catalogue">
      <div className="section-heading">
        <h2>
          <ClipboardList size={21} />
          当前记录类型
        </h2>
        <span className="muted small">共 {types.length} 个</span>
      </div>
      <div className="type-table-head" aria-hidden="true">
        <span>事项与规则</span>
        <span>每次变动</span>
        <span />
      </div>
      <div className="type-rows">
        {types.map((t) => (
          <article key={t.code} className="type-row">
            <div className="type-description">
              <h3>{t.name}</h3>
              <span className={'pill ' + (t.custom ? 'custom-label' : '')}>
                {t.custom ? '自定义' : '协议预设'}
              </span>
              <p>{t.note}</p>
            </div>
            <div className="type-values">
              {t.money !== '¥0.00' && (
                <div className="type-money">
                  {t.money.split('；').map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              )}
              {t.points !== 0 && (
                <strong className={t.points < 0 ? 'negative' : 'positive'}>
                  {t.points > 0 ? '+' : ''}
                  {t.points} 积分
                </strong>
              )}
            </div>
            <Link
              className="text-link type-record"
              href={
                '/events/new?' +
                new URLSearchParams({ type: t.code, ...(subject ? { subject } : {}) })
              }
            >
              记一笔 <ArrowUpRight size={14} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
export default async function Types({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireUser();
  const { rules, types } = await currentRules(database());
  const subject = value(await searchParams, 'subject');
  const catalogue = [
    ...presetTypes(rules),
    ...types.map((t) => ({
      code: t.code,
      name: t.name,
      money: money(t.money),
      points: t.points,
      note: '按实际发生次数登记，月底统一结算。',
      custom: true,
    })),
  ];
  return (
    <>
      <PageHeading
        eyebrow="把每一份约定，说清楚"
        title="记录类型"
        description="查看所有预设和自定义类型，再按次数记录。金额与积分在月底统一核算。"
      >
        {actor.role === 'ADMIN' && (
          <Button asChild>
            <a href="#add-type">
              <Plus size={17} />
              新增类型
            </a>
          </Button>
        )}
      </PageHeading>
      <section className="rules-note" aria-label="规则说明">
        <span className="round-icon peach">
          <ShieldCheck size={22} />
        </span>
        <div>
          <strong>先约定，再记录</strong>
          <p>金钱奖励与扣减每协议月各自封顶 {money(rules.cap)}，积分独立累计。</p>
        </div>
        <Link href="/agreement" className="text-link">
          我们的约定 <ArrowUpRight size={15} />
        </Link>
      </section>
      <TypeCatalogue types={catalogue} subject={subject} />
      <p className="notice" style={{ marginTop: 22 }}>
        整协议月无学习哭泣的 {money(rules.monthlyBonus)}{' '}
        奖励由月底总结自动提出，不需手动登记；反向更正请从原记录详情发起。
      </p>
      {actor.role === 'ADMIN' && (
        <section id="add-type" className="panel form-panel" style={{ marginTop: 22 }}>
          <div className="form-intro">
            <span className="round-icon sage">
              <Shapes size={22} />
            </span>
            <div>
              <h2>添加一个记录类型</h2>
              <p className="muted small">正数表示奖励，负数表示扣减。创建类型不会直接改变钱包。</p>
            </div>
          </div>
          <CommandForm>
            <input type="hidden" name="action" value="create-type" />
            <div className="form-grid">
              <div className="full-width">
                <label htmlFor="type-name">类型名称</label>
                <input
                  id="type-name"
                  name="name"
                  placeholder="例如：周末阅读奖励、历史奖励补录"
                  maxLength={60}
                  required
                />
              </div>
              <div>
                <label htmlFor="type-money">每次金钱（元）</label>
                <input
                  id="type-money"
                  name="money"
                  type="number"
                  step="0.01"
                  defaultValue="0"
                  required
                />
              </div>
              <div>
                <label htmlFor="type-points">每次积分币</label>
                <input
                  id="type-points"
                  name="points"
                  type="number"
                  step="1"
                  defaultValue="0"
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <p className="muted small">创建后保留类型定义，不删除或覆盖历史单价。</p>
              <Button>
                <Plus size={17} />
                新增记录类型
              </Button>
            </div>
          </CommandForm>
        </section>
      )}
    </>
  );
}
