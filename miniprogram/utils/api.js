function createApi(platform, config) {
  const token = () => platform.getStorageSync('family-session') || '';
  const clear = () => platform.removeStorageSync('family-session');
  function unauthorized() {
    clear();
    platform.reLaunch({ url: '/pages/login/index' });
  }
  function request(method, data) {
    const query =
      method === 'GET'
        ? '?' +
          Object.keys(data)
            .filter((k) => data[k] !== undefined && data[k] !== '')
            .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
            .join('&')
        : '';
    return new Promise((resolve, reject) => {
      platform.request({
        url: config.baseUrl + '/api/mini' + query,
        method,
        header: {
          'Content-Type': 'application/json',
          ...(token() ? { Authorization: 'Bearer ' + token() } : {}),
        },
        ...(method === 'POST' ? { data } : {}),
        success(response) {
          if (response.statusCode === 401) unauthorized();
          if (response.statusCode !== 200)
            return reject(new Error(response.data.error || '请求失败'));
          resolve(response.data);
        },
        fail() {
          reject(new Error('无法连接服务器，请检查网络和服务地址'));
        },
      });
    });
  }
  const command = (action, data = {}) => request('POST', { ...data, action });
  async function login(username, password) {
    const result = await command('login', { username, password });
    platform.setStorageSync('family-session', result.token);
    return result.user;
  }
  async function logout() {
    await command('logout');
    clear();
  }
  function document(format) {
    return new Promise((resolve, reject) => {
      platform.downloadFile({
        url: config.baseUrl + '/api/mini?resource=agreement&format=' + format,
        header: { Authorization: 'Bearer ' + token() },
        success(response) {
          if (response.statusCode === 401) unauthorized();
          if (response.statusCode !== 200)
            return reject(
              new Error(response.statusCode === 401 ? '请先登录' : '协议附件尚未就绪或下载失败'),
            );
          platform.openDocument({
            filePath: response.tempFilePath,
            fileType: format,
            showMenu: true,
            success: resolve,
            fail() {
              reject(new Error('无法打开协议文件'));
            },
          });
        },
        fail() {
          reject(new Error('无法下载协议，请检查网络'));
        },
      });
    });
  }
  return {
    token,
    login,
    logout,
    command,
    document,
    get: (resource, data = {}) => request('GET', { ...data, resource }),
    requestKey: () => 'mini-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
  };
}
module.exports = { createApi };
