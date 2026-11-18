import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createDatabase } from '../../src/server/db';
import { Accounts } from '../../src/server/accounts';
import { miniPage } from '../support/mini-runtime';
const require = createRequire(import.meta.url);
const { createApi } = require('../../miniprogram/utils/api.js');
const password = 'mini-http-test-password';
const suffix = Date.now().toString(36);
const usernames = { dad: 'mini_dad_' + suffix, child: 'mini_child_' + suffix };
let child: string;
test.beforeAll(async () => {
  const url = 'file:./data/browser.db';
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  const db = createDatabase(url);
  try {
    const accounts = new Accounts(db);
    const dad = await accounts.create(usernames.dad, '小程序爸爸', 'ADMIN', password, 0, 0);
    child = (await accounts.create(usernames.child, '小程序孩子', 'USER', password, 0, 20)).id;
    await accounts.setup(dad, '2026-09-18');
  } finally {
    await db.$disconnect();
  }
});
test('小程序页面通过真实 HTTP 与 Web 共享登记、确认、更正和结算', async ({ page }) => {
  const storage = new Map();
  const navigations: string[] = [];
  const wx = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    navigateTo: ({ url }: any) => navigations.push(url),
    redirectTo: ({ url }: any) => navigations.push(url),
    reLaunch: ({ url }: any) => navigations.push(url),
    request(options: any) {
      fetch(options.url, {
        method: options.method,
        headers: options.header,
        ...(options.data ? { body: JSON.stringify(options.data) } : {}),
      })
        .then(async (response) =>
          options.success({ statusCode: response.status, data: await response.json() }),
        )
        .catch(options.fail);
    },
    showModal: async () => ({ confirm: true }),
  };
  const api = createApi(wx, { baseUrl: 'http://127.0.0.1:3100' });
  const app = { api, globalData: { subject: child } };
  const screen = (name: string, options = {}) => miniPage(name, app, wx, options);
  const login = screen('login');
  await login.submit({ detail: { value: { username: usernames.dad, password } } });
  expect(login.data.error).toBe('');
  app.globalData.subject = child;
  const home = screen('home');
  await home.onShow();
  expect(home.data.subject.id).toBe(child);
  expect(home.data.wallet.points).toBe(20);
  const record = screen('record', { asset: 'POINTS' });
  await record.onShow();
  record.setData({
    typeIndex: record.data.types.findIndex((t: any) => t.code === 'DICTATION'),
    date: '2026-09-20',
    time: '18:00',
  });
  const reason = '小程序 HTTP 默写 ' + suffix;
  await record.submit({ detail: { value: { quantity: '1', reason } } });
  expect(record.data.error).toBe('');
  const eventId = navigations.at(-1)!.split('id=')[1];
  expect(eventId).toBeTruthy();
  // The existing Web reads the exact record written by the mini-program page.
  await page.goto('/login');
  await page.getByLabel('帐号').fill(usernames.child);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3100/');
  await page.goto('/events/' + eventId);
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '确认这条记录' }).click();
  await expect(page.getByText('已确认', { exact: true }).first()).toBeVisible();
  const detail = screen('event', { id: eventId });
  await detail.onShow();
  expect(detail.data.event.status).toBe('CONFIRMED');
  expect(detail.data.canDelete).toBe(false);
  await detail.reverse({ detail: { value: { reason: '联调更正' } } });
  expect(detail.data.error).toBe('');
  const reverseId = navigations.at(-1)!.split('id=')[1];
  await api.login(usernames.child, password);
  const reversal = screen('event', { id: reverseId });
  await reversal.onShow();
  await reversal.decide({
    currentTarget: { dataset: { decision: 'CONFIRM' } },
    detail: { value: {} },
  });
  expect(reversal.data.error).toBe('');
  await api.login(usernames.dad, password);
  const summaries = screen('settlements');
  await summaries.onShow();
  summaries.setData({ start: '2026-09-18' });
  await summaries.generate();
  expect(summaries.data.error).toBe('');
  const summaryId = navigations.at(-1)!.split('id=')[1];
  await api.login(usernames.child, password);
  const summary = screen('summary', { id: summaryId });
  await summary.onShow();
  expect(summary.data.canConfirm).toBe(true);
  await summary.confirm();
  expect(summary.data.error).toBe('');
  await api.login(usernames.dad, password);
  await summary.onShow();
  expect(summary.data.canPost).toBe(true);
  await summary.post();
  expect(summary.data.error).toBe('');
  expect(summary.data.settlement.postedAt).toBeTruthy();
  await api.command('post', { id: summaryId });
  await home.onShow();
  expect(home.data.wallet).toMatchObject({ money: 50000, points: 20 });
  await page.goto('/money');
  await expect(page.getByText('¥500.00', { exact: true }).first()).toBeVisible();
  await home.logout();
  expect(api.token()).toBeFalsy();
});
