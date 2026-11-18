import Link from 'next/link';
import { Wallet, Sparkles, Plus, ArrowUpRight } from 'lucide-react';
import { view, money, dateTime, type Search } from '../server/view';
import { PageHeading, SubjectPicker, Empty } from './shell';
import { EventList } from './event-list';
import { Button } from './ui/button';
import { eventMatchesAsset, type Asset } from '../domain/assets';
export async function WalletPage({ asset, search }: { asset: Asset; search: Search }) {
  const v = await view(search),
    points = asset === 'POINTS';
  const query = '?subject=' + v.subject.id + '&asset=' + asset;
  const entries = await v.db.walletEntry.findMany({
    where: { subjectId: v.subject.id, asset },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const events = v.events.filter((e) => eventMatchesAsset(e, asset, v.snapshot.rules, v.events));
  const Icon = points ? Sparkles : Wallet;
  return (
    <>
      <PageHeading
        eyebrow={points ? '让每一份努力，慢慢积累' : '认真对待每一份约定'}
        title={points ? '积分钱包' : '金钱钱包'}
        description={
          points ? '努力和付出，慢慢成为自己的底气。' : '记录金钱奖惩，月底一起核对，再更新钱包。'
        }
      >
        <Button asChild>
          <Link href={'/events/new' + query}>
            <Plus size={18} />
            记一笔
          </Link>
        </Button>
        {points && (
          <Button variant="outline" asChild>
            <Link href={'/events/new' + query + '&type=SKIP'}>跳过课外试卷</Link>
          </Button>
        )}
      </PageHeading>
      {v.actor.role === 'ADMIN' && <SubjectPicker users={v.users} current={v.subject.id} />}
      <div className={'wallet-overview panel ' + (points ? 'balance-points' : 'balance-money')}>
        <span className={'round-icon ' + (points ? 'sage' : 'peach')}>
          <Icon size={25} />
        </span>
        <div>
          <p className="card-kicker">
            {v.subject.name} 的{points ? '积分' : '金钱'}钱包 · 已结算
          </p>
          <strong className={'balance-number ' + (!points && v.wallet.money < 0 ? 'negative' : '')}>
            {points ? v.wallet.points : money(v.wallet.money)}
            {points && <small>积分币</small>}
          </strong>
          <p className="wallet-period">
            本协议月 {v.period.start} — {v.period.end}
          </p>
        </div>
        <div className="wallet-overview-note">
          <span>本月预计变化 · 未入账</span>
          <strong>
            {points
              ? (v.preview.records.pointsDelta >= 0 ? '+' : '') +
                v.preview.records.pointsDelta +
                ' 积分'
              : (v.preview.records.moneyDelta >= 0 ? '+' : '') +
                money(v.preview.records.moneyDelta)}
          </strong>
          <small>仅本协议月已确认记录，不含月度奖励及往期调整</small>
        </div>
      </div>
      <div className="two-columns">
        <section className="panel records-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">每一笔事实，认真留下</p>
              <h2>{points ? '积分事项' : '金钱事项'}</h2>
            </div>
            <Link href={'/history' + query} className="text-link">
              完整历史 <ArrowUpRight size={16} />
            </Link>
          </div>
          <EventList
            events={events.slice(0, 10)}
            history={v.events}
            rules={v.snapshot.rules}
            asset={asset}
          />
        </section>
        <section className="panel records-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">每一次入账，清楚可查</p>
              <h2>钱包变更流水</h2>
            </div>
          </div>
          {entries.length ? (
            <div className="ledger-list">
              {entries.map((e) => (
                <div className="ledger-row" key={e.id}>
                  <div>
                    <strong>
                      {e.settlementId.startsWith('opening:') ? '初始余额' : '月度统一入账'}
                    </strong>
                    <small>{dateTime(e.createdAt)}</small>
                    <small>
                      变更前 {points ? e.before : money(e.before)} → 变更后{' '}
                      {points ? e.after : money(e.after)}
                    </small>
                  </div>
                  <strong className={e.delta < 0 ? 'negative' : 'positive'}>
                    {e.delta >= 0 ? '+' : ''}
                    {points ? e.delta : money(e.delta)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="还没有入账记录"
              description="完成第一次月度结算后，这里会留下钱包的变化。"
            />
          )}
        </section>
      </div>
    </>
  );
}
