const { run, load, subject } = require('../../utils/page');
const { money, typeDescription } = require('../../utils/view');

Page({
  data: { busy: false, error: '', types: [], admin: false },
  onShow() {
    return load(this, async () => {
      const [data, context] = await Promise.all([
        getApp().api.get('types'),
        getApp().api.get('dashboard', { subject: subject() }),
      ]);
      this.setData({
        types: data.types.map((t) => ({ ...t, description: typeDescription(t.code, data.rules) })),
        admin: context.actor.role === 'ADMIN',
      });
    });
  },
  record(event) {
    wx.navigateTo({ url: '/pages/record/index?type=' + event.currentTarget.dataset.code });
  },
  submit(event) {
    return run(this, async () => {
      const form = event.detail.value;
      const yuan = form.money.trim();
      if (!/^-?\d+(\.\d{1,2})?$/.test(yuan)) throw new Error('金额最多保留两位小数');
      await getApp().api.command('create-type', {
        name: form.name,
        money: Math.round(Number(yuan) * 100),
        points: Number(form.points),
      });
      const data = await getApp().api.get('types');
      this.setData({
        types: data.types.map((t) => ({ ...t, description: typeDescription(t.code, data.rules) })),
        saved: true,
      });
    });
  },
});
