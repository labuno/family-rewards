async function run(page, work) {
  if (page.data.busy) return;
  page.setData({ busy: true, error: '' });
  try {
    return await work();
  } catch (error) {
    page.setData({ error: error.message || '操作失败' });
  } finally {
    page.setData({ busy: false });
  }
}
function load(page, work) {
  if (!getApp().api.token()) {
    wx.reLaunch({ url: '/pages/login/index' });
    return Promise.resolve();
  }
  return run(page, work);
}
function subject() {
  return getApp().globalData.subject || undefined;
}
function input(page, event) {
  page.setData({ [event.currentTarget.dataset.field]: event.detail.value });
}
module.exports = { run, load, subject, input };
