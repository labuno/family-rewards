import Link from 'next/link';
import { Plus, Search as SearchIcon } from 'lucide-react';
import { view, value, type Search } from '../../../server/view';
import { PageHeading, SubjectPicker } from '../../../components/shell';
import { EventList } from '../../../components/event-list';
import { EVENT_LABELS } from '../../../domain/rules';
import { RecordTypes } from '../../../server/record-types';
import { Button } from '../../../components/ui/button';
import { readAsset, eventMatchesAsset, typeMatchesAsset } from '../../../domain/assets';
export default async function History({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams,
    v = await view(search);
  const types = await new RecordTypes(v.db).list();
  const asset = readAsset(value(search, 'asset'));
  const assetQuery = asset ? '&asset=' + asset : '';
  const filter = value(search, 'type'),
    query = value(search, 'q') ?? '';
  const period = value(search, 'period') ?? '',
    status = value(search, 'status') ?? '';
  const all = v.events.filter(
    (e) =>
      (!asset || eventMatchesAsset(e, asset, v.snapshot.rules, v.events)) &&
      (!filter || e.type === filter) &&
      (!period || e.periodStart === period) &&
      (!status || e.status === status) &&
      (!query || e.reason.includes(query) || e.source.includes(query)),
  );
  const page = Math.max(1, Number(value(search, 'page')) || 1),
    size = 25;
  return (
    <>
      <PageHeading
        eyebrow="每一件小事，都值得认真留下"
        title={asset === 'MONEY' ? '金钱记录' : asset === 'POINTS' ? '积分记录' : '成长记录'}
        description="好的、难的、值得再聊聊的，都认真留下。"
      >
        <Button asChild>
          <Link href={'/events/new?subject=' + v.subject.id + assetQuery}>
            <Plus size={18} />
            记一笔
          </Link>
        </Button>
      </PageHeading>
      {v.actor.role === 'ADMIN' && (
        <SubjectPicker users={v.users} current={v.subject.id} asset={asset} />
      )}
      <form className="filter-bar" method="GET">
        <input name="subject" type="hidden" value={v.subject.id} />
        {asset && <input name="asset" type="hidden" value={asset} />}
        <div className="search-input">
          <SearchIcon size={18} />
          <input
            name="q"
            aria-label="搜索记录"
            defaultValue={query}
            placeholder="搜索原因或事项来源"
          />
        </div>
        <select name="type" aria-label="筛选事项" defaultValue={filter ?? ''}>
          <option value="">全部事项</option>
          {[...Object.entries(EVENT_LABELS), ...types.map((t) => [t.code, t.name])]
            .filter(
              ([key]) =>
                !asset || key === 'REVERSAL' || typeMatchesAsset(key, asset, v.snapshot.rules),
            )
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
        <input
          name="period"
          type="date"
          aria-label="筛选协议月"
          title="协议月起点"
          defaultValue={period}
          className="period-filter"
        />
        <select name="status" aria-label="筛选状态" defaultValue={status}>
          <option value="">全部状态</option>
          <option value="PENDING">待确认</option>
          <option value="CONFIRMED">已确认</option>
          <option value="DISPUTED">待沟通</option>
          <option value="REVERSED">已反向抵销</option>
        </select>
        <Button variant="outline">筛选</Button>
      </form>
      <section className="panel records-panel">
        <div className="section-heading">
          <h2>
            {v.subject.name} 的
            {asset === 'MONEY' ? '金钱记录' : asset === 'POINTS' ? '积分记录' : '全部记录'}
          </h2>
          <span className="muted small">共 {all.length} 条 · 原记录始终保留</span>
        </div>
        <EventList
          events={all.slice((page - 1) * size, page * size)}
          history={v.events}
          rules={v.snapshot.rules}
          asset={asset}
        />
        <div className="pagination">
          {page > 1 && (
            <Link
              href={
                '?' +
                new URLSearchParams({
                  subject: v.subject.id,
                  asset: asset ?? '',
                  page: String(page - 1),
                  q: query,
                  type: filter ?? '',
                  period,
                  status,
                })
              }
            >
              上一页
            </Link>
          )}
          <span>第 {page} 页</span>
          {page * size < all.length && (
            <Link
              href={
                '?' +
                new URLSearchParams({
                  subject: v.subject.id,
                  asset: asset ?? '',
                  page: String(page + 1),
                  q: query,
                  type: filter ?? '',
                  period,
                  status,
                })
              }
            >
              下一页
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
