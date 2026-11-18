const { run, load } = require('../../utils/page');
const { eventView, localTime } = require('../../utils/view');

Page({
  data: { busy: false, error: '', ready: false },
  onLoad(options) {
    this.id = options.id;
    this.keys = {};
  },
  onShow() {
    return this.refresh();
  },
  refresh() {
    return load(this, async () => {
      const data = await getApp().api.get('event', { id: this.id });
      this.setData({
        ...data,
        ready: true,
        event: eventView(data.event),
        evidence: JSON.parse(data.event.evidence),
        confirmations: data.event.confirmedBy.join('、'),
        createdText: localTime(data.event.createdAt),
        decisions: data.event.decisions.map((d) => ({ ...d, timeText: localTime(d.createdAt) })),
      });
    });
  },
  key(action) {
    if (!this.keys[action]) this.keys[action] = getApp().api.requestKey();
    return this.keys[action];
  },
  decide(event) {
    const form = event.detail.value;
    return this.mutate('decide', {
      decision: event.currentTarget.dataset.decision,
      reason: form.reason || '',
    });
  },
  reverse(event) {
    return this.mutate('reverse', { reason: event.detail.value.reason });
  },
  mutate(action, fields) {
    return run(this, async () => {
      const result = await getApp().api.command(action, {
        eventId: this.id,
        requestKey: this.key(action + (fields.decision || '')),
        ...fields,
      });
      delete this.keys[action + (fields.decision || '')];
      if (action === 'reverse') wx.redirectTo({ url: '/pages/event/index?id=' + result.id });
      else {
        const data = await getApp().api.get('event', { id: this.id });
        this.setData({
          ...data,
          event: eventView(data.event),
          decisions: data.event.decisions.map((d) => ({ ...d, timeText: localTime(d.createdAt) })),
          confirmations: data.event.confirmedBy.join('、'),
        });
      }
    });
  },
  remove() {
    return run(this, async () => {
      const answer = await wx.showModal({
        title: '删除未确认记录',
        content: '删除后不参与结算，并保留操作记录。',
      });
      if (!answer.confirm) return;
      await getApp().api.command('delete-event', { eventId: this.id });
      wx.redirectTo({ url: '/pages/history/index' });
    });
  },
  original() {
    wx.navigateTo({ url: '/pages/event/index?id=' + this.data.event.reverseOf });
  },
});
