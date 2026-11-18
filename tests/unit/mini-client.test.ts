import { createRequire } from 'node:module';
import { miniPage } from '../support/mini-runtime';
import { describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { createApi } = require('../../miniprogram/utils/api.js');
function platform() {
  const storage = new Map();
  return {
    getStorageSync: (k: string) => storage.get(k),
    setStorageSync: (k: string, v: unknown) => storage.set(k, v),
    removeStorageSync: (k: string) => storage.delete(k),
    reLaunch: vi.fn(),
    request: vi.fn(),
    downloadFile: vi.fn(),
    openDocument: vi.fn(),
  };
}
export function loadPage(
  name: string,
  api: Record<string, unknown>,
  options: Record<string, string> = {},
) {
  let page: any;
  const app = { api, globalData: { subject: '' } };
  const wx = {
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
    reLaunch: vi.fn(),
    stopPullDownRefresh: vi.fn(),
    showModal: vi.fn(async () => ({ confirm: true })),
  };
  page = miniPage(name, app, wx, options);
  return { page, wx, app };
}
describe('小程序客户端边界', () => {
  it('登录后保存会话并发送 JSON/Bearer，网络错误明确返回', async () => {
    const wx = platform(),
      api = createApi(wx, { baseUrl: 'http://localhost:3100' });
    wx.request.mockImplementation((o: any) =>
      o.success({ statusCode: 200, data: { token: 'session', user: { name: '孩子' } } }),
    );
    await api.login('child', 'password');
    expect(api.token()).toBe('session');
    await api.get('history', { asset: 'POINTS' });
    const call = wx.request.mock.calls[1][0];
    expect(call.header.Authorization).toBe('Bearer session');
    expect(call.url).toContain('resource=history');
    wx.request.mockImplementation((o: any) => o.fail({ errMsg: 'request:fail' }));
    await expect(api.get('dashboard')).rejects.toThrow('无法连接');
  });
  it('401 清理会话回登录；业务错误保留会话', async () => {
    const wx = platform(),
      api = createApi(wx, { baseUrl: 'http://localhost:3100' });
    wx.setStorageSync('family-session', 'session');
    wx.request.mockImplementation((o: any) =>
      o.success({ statusCode: 400, data: { error: '协议月尚未结束' } }),
    );
    await expect(api.command('generate', {})).rejects.toThrow('协议月尚未结束');
    expect(api.token()).toBe('session');
    wx.request.mockImplementation((o: any) =>
      o.success({ statusCode: 401, data: { error: '请先登录' } }),
    );
    await expect(api.get('dashboard')).rejects.toThrow('请先登录');
    expect(api.token()).toBeFalsy();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });
  it('附件携带会话，成功打开，HTTP 失败不预览', async () => {
    const wx = platform(),
      api = createApi(wx, { baseUrl: 'http://localhost:3100' });
    wx.setStorageSync('family-session', 'session');
    wx.downloadFile.mockImplementation((o: any) =>
      o.success({ statusCode: 200, tempFilePath: '/tmp/agreement.pdf' }),
    );
    wx.openDocument.mockImplementation((o: any) => o.success({}));
    await api.document('pdf');
    expect(wx.downloadFile.mock.calls[0][0].header.Authorization).toBe('Bearer session');
    expect(wx.openDocument.mock.calls[0][0].filePath).toBe('/tmp/agreement.pdf');
    wx.downloadFile.mockImplementation((o: any) => o.success({ statusCode: 404 }));
    await expect(api.document('docx')).rejects.toThrow('协议附件');
    expect(wx.openDocument).toHaveBeenCalledTimes(1);
  });
  it('登录页面提交成功进入看板，失败留在页面', async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(new Error('帐号或密码错误'))
      .mockResolvedValueOnce({});
    const { page, wx } = loadPage('login', { login });
    const event = { detail: { value: { username: 'child', password: 'password' } } };
    await page.submit(event);
    expect(page.data.error).toBe('帐号或密码错误');
    await page.submit(event);
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/home/index' });
  });
  it('登记失败后重试保留标识，成功转到详情，快速重复点击只请求一次', async () => {
    const command = vi
      .fn()
      .mockRejectedValueOnce(new Error('网络失败'))
      .mockResolvedValueOnce({ id: 'event-1' });
    const { page, wx, app } = loadPage(
      'record',
      { command, token: () => 'session', requestKey: () => 'same-key' },
      { asset: 'POINTS' },
    );
    app.globalData.subject = 'child';
    page.setData({
      types: [{ code: 'DICTATION', name: '默写全对' }],
      typeIndex: 0,
      date: '2026-09-20',
      time: '18:00',
    });
    const event = { detail: { value: { quantity: '1', reason: '默写' } } };
    await page.submit(event);
    expect(page.data.error).toBe('网络失败');
    await Promise.all([page.submit(event), page.submit(event)]);
    expect(command).toHaveBeenCalledTimes(2);
    expect(command.mock.calls[0][1].requestKey).toBe(command.mock.calls[1][1].requestKey);
    expect(command.mock.calls[1][1]).toMatchObject({
      subjectId: 'child',
      occurredAt: '2026-09-20T18:00:00+08:00',
    });
    expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/event/index?id=event-1' });
  });
  it('历史分页保持成员、资产和筛选，失败保留已加载记录', async () => {
    const history = vi
      .fn()
      .mockResolvedValueOnce({
        events: [
          {
            id: 'a',
            occurredAt: '2026-09-20T10:00:00Z',
            impact: { money: 0, points: 1 },
            status: 'PENDING',
          },
        ],
        hasMore: true,
      })
      .mockRejectedValueOnce(new Error('网络失败'));
    const get = vi.fn((resource: string, _query?: any) =>
      resource === 'types'
        ? Promise.resolve({ types: [{ code: 'DICTATION', name: '默写全对' }] })
        : history(),
    );
    const { page, app } = loadPage('history', { get, token: () => 'session' }, { asset: 'POINTS' });
    app.globalData.subject = 'child';
    await page.onShow();
    await page.more();
    expect(get.mock.calls.at(-1)![1]).toMatchObject({ asset: 'POINTS', subject: 'child', page: 2 });
    expect(page.data.events).toHaveLength(1);
    expect(page.data.error).toBe('网络失败');
  });
  it('历史使用类型名称筛选，保留资产范围与协议月', async () => {
    const get = vi.fn((resource: string, _query?: any) =>
      Promise.resolve(
        resource === 'types'
          ? { types: [{ code: 'DICTATION', name: '默写全对' }] }
          : { events: [], hasMore: false, total: 0 },
      ),
    );
    const { page } = loadPage('history', { get, token: () => 'session' }, { asset: 'POINTS' });
    await page.onShow();
    await page.chooseType({ detail: { value: '1' } });
    expect(get.mock.calls.at(-1)![1]).toMatchObject({
      type: 'DICTATION',
      asset: 'POINTS',
      page: 1,
    });
    await page.period({ detail: { value: '2026-09-18' } });
    expect(get.mock.calls.at(-1)![1]).toMatchObject({ type: 'DICTATION', period: '2026-09-18' });
  });
  it('已有有效会话时打开登录页直接返回看板', () => {
    const { page, wx } = loadPage('login', { token: () => 'session' });
    page.onShow();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/home/index' });
  });
});
