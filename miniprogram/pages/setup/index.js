const { run, load } = require('../../utils/page');

Page({
  data: { busy: false, error: '', anchor: '', admin: false },
  onShow() {
    return load(this, async () => {
      const data = await getApp().api.get('dashboard');
      this.setData({ admin: data.actor.role === 'ADMIN' });
      if (!data.needsSetup) wx.reLaunch({ url: '/pages/home/index' });
    });
  },
  change(event) {
    this.setData({ anchor: event.detail.value });
  },
  submit() {
    return run(this, async () => {
      await getApp().api.command('setup', { anchor: this.data.anchor });
      wx.reLaunch({ url: '/pages/home/index' });
    });
  },
});
