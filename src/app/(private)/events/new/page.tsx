import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { ArrowLeft, NotebookPen } from 'lucide-react';
import { view, value, type Search } from '../../../../server/view';
import { PageHeading } from '../../../../components/shell';
import { RecordTypes } from '../../../../server/record-types';
import { EventForm } from '../../../../components/event-form';
import { readAsset, typeMatchesAsset } from '../../../../domain/assets';
export default async function New({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams,
    v = await view(search);
  const types = await new RecordTypes(v.db).list();
  const asset = readAsset(value(search, 'asset'));
  const defaultType = value(search, 'type') ?? (asset === 'MONEY' ? 'SCHOOL' : 'CHORE');
  if (asset && !typeMatchesAsset(defaultType, asset, v.snapshot.rules))
    throw new Error('该事项不属于当前钱包');
  const time = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(' ', 'T');
  return (
    <>
      <Link
        className="back-link"
        href={
          (asset === 'MONEY' ? '/money' : asset === 'POINTS' ? '/points' : '/') +
          '?subject=' +
          v.subject.id
        }
      >
        <ArrowLeft size={16} />
        {asset ? '返回钱包' : '返回看板'}
      </Link>
      <PageHeading
        eyebrow="记录今天的小小瞬间"
        title="记下一件小事"
        description={
          (asset === 'MONEY' ? '金钱事项 · ' : asset === 'POINTS' ? '积分事项 · ' : '') +
          '为 ' +
          v.subject.name +
          ' 留下一条真实、清楚的成长记录。'
        }
      />
      <section className="panel form-panel">
        <div className="form-intro">
          <span className="round-icon sage">
            <NotebookPen size={22} />
          </span>
          <div>
            <h2>事实先记下，结果一起确认</h2>
            <p className="muted small">时间按北京时间填写，系统会根据协议月统一计算。</p>
          </div>
        </div>
        <EventForm
          rules={v.snapshot.rules}
          asset={asset}
          types={types.map((t) => ({ code: t.code, name: t.name }))}
          subjectId={v.subject.id}
          requestKey={randomUUID()}
          defaultType={defaultType}
          defaultTime={time}
        />
      </section>
      <Link className="text-link" style={{ marginTop: 18 }} href="/record-types">
        {v.actor.role === 'ADMIN' ? '添加或查看记录类型' : '查看记录类型对应表'}
      </Link>
    </>
  );
}
