const { run, load, subject } = require('../../utils/page');
const { money, eventView } = require('../../utils/view');

Page({
  data: { busy: false, error: '', ready: false },
  onShow() {
    return this.refresh();
  },
  refresh() {
    return load(this, async () => {
      const data = await getApp().api.get('dashboard', { subject: subject() });
      if (data.needsSetup) {
        wx.navigateTo({ url: '/pages/setup/index' });
        return;
      }
      getApp().globalData.subject = data.subject.id;
      this.setData({
        ...data,
        ready: true,
        moneyText: money(data.wallet.money),
        previewMoney: money(data.preview.records.moneyDelta),
        bonusMoney: money(data.preview.bonus.amount),
        userIndex: data.users.findIndex((u) => u.id === data.subject.id),
        recent: data.recent.map((e) => eventView(e)),
        pending: data.pending.map((e) => eventView(e)),
      });
    });
  },
  changeSubject(event) {
    getApp().globalData.subject = this.data.users[Number(event.detail.value)].id;
    return this.refresh();
  },
  open(event) {
    wx.navigateTo({ url: event.currentTarget.dataset.url });
  },
  logout() {
    return run(this, async () => {
      await getApp().api.logout();
      getApp().globalData.subject = '';
      wx.reLaunch({ url: '/pages/login/index' });
    });
  },
});
