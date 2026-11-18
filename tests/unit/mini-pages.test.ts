import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { miniPage } from '../support/mini-runtime';
const require = createRequire(import.meta.url);
const { typeDescription, eventView } = require('../../miniprogram/utils/view.js');
import { DEFAULT_RULES as rules } from '../../src/domain/rules';
function screen(name: string, api: any, options = {}) {
  const app = {
    api: { token: () => 'session', requestKey: () => 'key', ...api },
    globalData: { subject: 'child' },
  };
  const wx = {
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
    reLaunch: vi.fn(),
    showModal: vi.fn(async () => ({ confirm: true })),
  };
  return { page: miniPage(name, app, wx, options), app, wx };
}
describe('原生页面业务交互', () => {
  it('所有声明页面均有模板、配置及有效事件处理器', () => {
    const app = JSON.parse(readFileSync('miniprogram/app.json', 'utf8'));
    for (const path of app.pages) {
      expect(existsSync(resolve('miniprogram', path + '.json'))).toBe(true);
      const name = path.split('/')[1];
      const { page } = screen(name, {});
      const template = readFileSync(resolve('miniprogram', path + '.wxml'), 'utf8');
      for (const match of template.matchAll(/(?:bind|catch)(?:tap|submit|input|change)="([^"]+)"/g))
        expect(typeof page[match[1]], path + ': ' + match[1]).toBe('function');
    }
  });
  it('看板切换成员后重新查询，并保持到后续页面', async () => {
    const get = vi.fn(async (_resource, query) => ({
      actor: { role: 'ADMIN' },
      subject: { id: query.subject || 'child', name: '孩子' },
      users: [{ id: 'child' }, { id: 'dad' }],
      wallet: { money: 100, points: 2 },
      period: { start: '2026-11-18', end: '2026-12-18' },
      preview: { records: { moneyDelta: 0 }, bonus: { amount: 50000 } },
      pending: [],
      recent: [],
    }));
    const { page, app } = screen('home', { get });
    await page.onShow();
    await page.changeSubject({ detail: { value: '1' } });
    expect(app.globalData.subject).toBe('dad');
    expect(get.mock.calls[1][1].subject).toBe('dad');
  });
  it('普通成员不能设置协议月，管理员提交所选日期', async () => {
    const command = vi.fn();
    const get = vi
      .fn()
      .mockResolvedValueOnce({ actor: { role: 'USER' }, needsSetup: true })
      .mockResolvedValueOnce({ actor: { role: 'ADMIN' }, needsSetup: true });
    const { page, wx } = screen('setup', { get, command });
    await page.onShow();
    expect(page.data.admin).toBe(false);
    await page.onShow();
    expect(page.data.admin).toBe(true);
    page.change({ detail: { value: '2026-09-18' } });
    await page.submit();
    expect(command).toHaveBeenCalledWith('setup', { anchor: '2026-09-18' });
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/home/index' });
  });
  it('考试缺分数和大吼缺对象时不提交，预览不将空分数当零分', async () => {
    const command = vi.fn(),
      get = vi.fn();
    const { page } = screen('record', { command, get });
    page.setData({ types: [{ code: 'BASIC' }], typeIndex: 0, score: '' });
    await page.preview();
    expect(get).not.toHaveBeenCalled();
    expect(page.data.error).toContain('分数');
    await page.submit({ detail: { value: { quantity: '1', reason: '测试' } } });
    expect(command).not.toHaveBeenCalled();
    page.setData({ types: [{ code: 'SHOUT' }], targetIndex: -1 });
    await page.submit({ detail: { value: { quantity: '1', reason: '测试' } } });
    expect(page.data.error).toContain('对象');
    expect(command).not.toHaveBeenCalled();
  });
  it('新增类型以整数分提交，失败保留错误，非法金额不提交', async () => {
    const command = vi.fn(),
      get = vi.fn().mockResolvedValue({ types: [], rules });
    const { page } = screen('types', { command, get });
    await page.submit({ detail: { value: { name: '阅读', money: '1.25', points: '2' } } });
    expect(command).toHaveBeenCalledWith('create-type', { name: '阅读', money: 125, points: 2 });
    await page.submit({ detail: { value: { name: '阅读', money: '1.001', points: '2' } } });
    expect(page.data.error).toContain('两位小数');
    expect(command).toHaveBeenCalledTimes(1);
  });
  it('事件删除取消不写入，确认删除后回历史', async () => {
    const command = vi.fn();
    const { page, wx } = screen('event', { command }, { id: 'event' });
    wx.showModal.mockResolvedValueOnce({ confirm: false });
    await page.remove();
    expect(command).not.toHaveBeenCalled();
    await page.remove();
    expect(command).toHaveBeenCalledWith('delete-event', { eventId: 'event' });
    expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/history/index' });
  });
  it('协议下载格式传给 API，失败呈现在页面', async () => {
    const document = vi.fn().mockRejectedValue(new Error('协议附件尚未就绪'));
    const { page } = screen('agreement', { document });
    await page.open({ currentTarget: { dataset: { format: 'docx' } } });
    expect(document).toHaveBeenCalledWith('docx');
    expect(page.data.error).toBe('协议附件尚未就绪');
  });
  it('资产投影隐藏另一钱包，规则说明来自当前协议', () => {
    expect(
      eventView(
        {
          occurredAt: '2026-09-20T12:00:00Z',
          status: 'PENDING',
          impact: { money: 100, points: 2 },
        },
        'MONEY',
      ),
    ).toMatchObject({ showMoney: true, showPoints: false, timeText: '2026-09-20 20:00' });
    expect(typeDescription('SCHOOL', rules)).toContain('¥200.00');
    expect(typeDescription('CHORE', rules)).toContain('每天最多一次');
  });
});
