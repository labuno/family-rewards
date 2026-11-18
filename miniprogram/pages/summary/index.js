const { run, load } = require('../../utils/page');
const { money } = require('../../utils/view');

Page({
  data: { busy: false, error: '', ready: false },
  onLoad(options) {
    this.id = options.id;
  },
  onShow() {
    return load(this, () => this.refresh());
  },
  async refresh() {
    const data = await getApp().api.get('settlement', { id: this.id });
    const s = data.snapshot;
    const sum = s.summary;
    this.setData({
      ...data,
      ready: true,
      moneyTotal: money(s.moneyTotal),
      rawReward: money(sum.rawReward),
      rawDeduction: money(sum.rawDeduction),
      reward: money(sum.reward),
      deduction: money(sum.deduction),
      bonus: money(sum.monthlyBonus),
      moneyDelta: money(sum.moneyDelta),
      participants: s.participants.map((p) => ({
        ...p,
        confirmed: data.confirmation.approvedIds.includes(p.id),
      })),
      adjustments: s.adjustments.map((a) => ({ ...a, moneyText: money(a.money) })),
      counts: data.counts,
    });
  },
  confirm() {
    return this.command('confirm-summary');
  },
  post() {
    return this.command('post');
  },
  command(action) {
    return run(this, async () => {
      await getApp().api.command(action, { id: this.id });
      await this.refresh();
    });
  },
});
