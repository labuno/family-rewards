const { run, load, subject, input } = require('../../utils/page');
const { money, localTime } = require('../../utils/view');

Page({
  data: {
    busy: false,
    error: '',
    types: [],
    typeIndex: 0,
    asset: '',
    date: '',
    time: '',
    grades: ['A+', 'A', 'B', 'C'],
    gradeIndex: 0,
    years: [
      '一年级上',
      '一年级下',
      '二年级上',
      '二年级下',
      '三年级上',
      '三年级下',
      '四年级上',
      '四年级下',
      '五年级上',
      '五年级下',
      '六年级上',
      '六年级下',
    ],
    yearIndex: 0,
    targets: ['爷爷', '奶奶', '爸爸', '妈妈', '姑姑', '其他'],
    targetIndex: -1,
    score: '',
    quantity: '1',
    previewText: '',
    type: '',
  },
  onLoad(options) {
    const now = localTime(new Date());
    this.setData({ asset: options.asset || '', date: now.slice(0, 10), time: now.slice(11) });
    this.requestKey = getApp().api.requestKey();
    this.defaultType = options.type;
  },
  onShow() {
    return load(this, async () => {
      const data = await getApp().api.get('types', { asset: this.data.asset });
      const index = Math.max(
        0,
        data.types.findIndex((t) => t.code === this.defaultType),
      );
      this.setData({ types: data.types, typeIndex: index, type: data.types[index].code });
    });
  },
  field(event) {
    input(this, event);
    this.setData({ previewText: '' });
  },
  choose(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: Number(event.detail.value), previewText: '' });
    if (field === 'typeIndex') this.setData({ type: this.data.types[this.data.typeIndex].code });
  },
  preview() {
    return run(this, async () => {
      const type = this.data.types[this.data.typeIndex].code;
      if (['BASIC', 'ADVANCED'].includes(type) && this.data.score === '')
        throw new Error('请填写试卷分数');
      const data = await getApp().api.get('preview', {
        type,
        quantity: Number(this.data.quantity),
        grade: this.data.grades[this.data.gradeIndex],
        ...(['BASIC', 'ADVANCED'].includes(type) ? { score: this.data.score } : {}),
      });
      this.setData({
        previewText: money(data.impact.money) + ' / ' + data.impact.points + ' 积分（未入账）',
      });
    });
  },
  submit(event) {
    return run(this, async () => {
      const type = this.data.types[this.data.typeIndex].code;
      const form = event.detail.value;
      const evidence = {};
      if (type === 'SCHOOL') evidence.grade = this.data.grades[this.data.gradeIndex];
      if (['BASIC', 'ADVANCED'].includes(type)) {
        if (this.data.score === '') throw new Error('请填写试卷分数');
        evidence.score = Number(this.data.score);
      }
      if (['SCHOOL', 'BASIC', 'ADVANCED'].includes(type))
        evidence.schoolYear = this.data.years[this.data.yearIndex];
      if (type === 'SHOUT') {
        if (this.data.targetIndex < 0) throw new Error('请选择对象');
        evidence.shoutTarget = this.data.targets[this.data.targetIndex];
      }
      const result = await getApp().api.command('record', {
        subjectId: subject(),
        type,
        occurredAt: this.data.date + 'T' + this.data.time + ':00+08:00',
        quantity: Number(form.quantity),
        reason: form.reason,
        ...(form.source ? { source: form.source } : {}),
        evidence,
        requestKey: this.requestKey,
      });
      wx.redirectTo({ url: '/pages/event/index?id=' + result.id });
    });
  },
});
