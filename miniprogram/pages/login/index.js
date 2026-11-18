const { run, subject } = require('../../utils/page');

Page({
  data: { busy: false, error: '' },
  onShow() {
    if (getApp().api.token()) wx.reLaunch({ url: '/pages/home/index' });
  },
  submit(event) {
    return run(this, async () => {
      const { username, password } = event.detail.value;
      await getApp().api.login(username.trim(), password);
      getApp().globalData.subject = '';
      wx.reLaunch({ url: '/pages/home/index' });
    });
  },
});
