const { load } = require('../../utils/page');

Page({
  data: { busy: false, error: '' },
  open(event) {
    return load(this, () => getApp().api.document(event.currentTarget.dataset.format));
  },
});
