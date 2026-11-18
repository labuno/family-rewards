const { run, load, subject } = require('../../utils/page');
const { summaryView } = require('../../utils/view');

Page({
  data: { busy: false, error: '', settlements: [], admin: false, start: '', pending: [] },
  onShow() {
    return load(this, async () => {
      const [data, context] = await Promise.all([
        getApp().api.get('settlements', { subject: subject() }),
        getApp().api.get('dashboard', { subject: subject() }),
      ]);
      this.setData({
        settlements: data.settlements.map(summaryView),
        admin: context.actor.role === 'ADMIN',
        start:
          this.data.start ||
          (context.recent || []).find((e) => e.periodStart < context.period.start)?.periodStart ||
          context.period.start,
        pending: context.pending,
      });
    });
  },
  change(event) {
    this.setData({ start: event.detail.value });
  },
  generate() {
    return run(this, async () => {
      const result = await getApp().api.command('generate', {
        subjectId: subject(),
        start: this.data.start,
      });
      wx.navigateTo({ url: '/pages/summary/index?id=' + result.id });
    });
  },
  open(event) {
    wx.navigateTo({ url: '/pages/summary/index?id=' + event.currentTarget.dataset.id });
  },
  event(event) {
    wx.navigateTo({ url: '/pages/event/index?id=' + event.currentTarget.dataset.id });
  },
});
