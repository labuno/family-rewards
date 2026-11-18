const { load, subject } = require('../../utils/page');
const { eventView } = require('../../utils/view');

Page({
  data: {
    busy: false,
    error: '',
    events: [],
    page: 0,
    hasMore: false,
    asset: '',
    statusIndex: 0,
    statuses: ['全部状态', '待确认', '已确认', '待沟通', '已抵销'],
    type: '',
    periodStart: '',
    typeIndex: 0,
    typeOptions: [{ code: '', name: '全部类型' }],
  },
  onLoad(options) {
    this.setData({ asset: options.asset || '' });
  },
  onShow() {
    return this.fetch(false);
  },
  fetch(append) {
    return load(this, async () => {
      if (!this.typesLoaded) {
        const data = await getApp().api.get('types', { asset: this.data.asset });
        this.setData({ typeOptions: [{ code: '', name: '全部类型' }].concat(data.types) });
        this.typesLoaded = true;
      }
      const page = append ? this.data.page + 1 : 1;
      const data = await getApp().api.get('history', {
        subject: subject(),
        asset: this.data.asset,
        page,
        type: this.data.type,
        period: this.data.periodStart,
        status: ['', 'PENDING', 'CONFIRMED', 'DISPUTED', 'REVERSED'][this.data.statusIndex],
      });
      this.setData({
        events: (append ? this.data.events : []).concat(
          data.events.map((e) => eventView(e, this.data.asset)),
        ),
        page,
        hasMore: data.hasMore,
        total: data.total,
      });
    });
  },
  more() {
    return this.fetch(true);
  },
  status(event) {
    this.setData({ statusIndex: Number(event.detail.value) });
    return this.fetch(false);
  },
  chooseType(event) {
    const index = Number(event.detail.value);
    this.setData({ typeIndex: index, type: this.data.typeOptions[index].code });
    return this.fetch(false);
  },
  period(event) {
    this.setData({ periodStart: event.detail.value });
    return this.fetch(false);
  },
  clearPeriod() {
    this.setData({ periodStart: '' });
    return this.fetch(false);
  },
  open(event) {
    wx.navigateTo({ url: '/pages/event/index?id=' + event.currentTarget.dataset.id });
  },
  add() {
    wx.navigateTo({ url: '/pages/record/index?asset=' + this.data.asset });
  },
});
