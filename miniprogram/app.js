const { createApi } = require('./utils/api');
const config = require('./config');
App({
  globalData: { subject: '' },
  onLaunch() {
    this.api = createApi(wx, config);
  },
});
