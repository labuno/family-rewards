import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
test.describe.configure({ mode: 'serial' });
const url = 'file:./data/browser.db';
const password = 'browser-test-password-123';
test.beforeAll(() => {
  mkdirSync('data', { recursive: true });
  rmSync('data/browser.db', { force: true });
  execFileSync('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  writeFileSync(
    'data/browser-accounts.json',
    JSON.stringify([
      { username: 'dad', name: '爸爸', role: 'ADMIN', password, money: 0, points: 0 },
      { username: 'mom', name: '妈妈', role: 'ADMIN', password, money: 0, points: 0 },
      { username: 'ellie', name: 'Ellie', role: 'USER', password, money: 5000, points: 20 },
      { username: 'preview', name: '预览验证', role: 'USER', password, money: 0, points: 0 },
      { username: 'wallet', name: '钱包验证', role: 'USER', password, money: 0, points: 0 },
    ]),
    { mode: 0o600 },
  );
  execFileSync('node', ['--import', 'tsx', 'scripts/accounts.ts', 'data/browser-accounts.json'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
});
async function login(page: import('@playwright/test').Page, username: string) {
  await page.goto('/login');
  const account = page.getByLabel('帐号');
  await expect(account).toHaveAttribute('autocapitalize', 'none');
  await expect(account).toHaveAttribute('autocorrect', 'off');
  await expect(account).toHaveAttribute('spellcheck', 'false');
  await account.fill('DaD');
  await expect(account).toHaveValue('DaD');
  await account.fill(username);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
test('手机：设置、看板、录入、确认和完整历史', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'dad');
  await expect(page.getByRole('heading', { name: '从一个约定开始' })).toBeVisible();
  await page.getByLabel('第一个协议月起点').fill('2026-09-18');
  await page.getByRole('button', { name: '开启家庭成长站' }).click();
  await expect(page.getByRole('heading', { name: '成长看板', exact: true })).toBeVisible();
  await expect(page.getByText('¥50.00', { exact: true })).toBeVisible();
  const regions = ['已结算钱包', '本月预计变化', '待确认事项', '本期事实明细'];
  let previousBottom = 0;
  for (const name of regions) {
    const region = page.getByRole('region', { name, exact: true });
    await expect(region).toBeVisible();
    const box = (await region.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(previousBottom);
    previousBottom = box.y + box.height;
  }
  await expect(page.getByRole('region', { name: '本月预计变化' })).toContainText('未入账');
  const recordButton = await page.getByRole('link', { name: '记一笔', exact: true }).boundingBox();
  expect(recordButton!.y + recordButton!.height).toBeLessThan(844);
  await expect(page.getByRole('link', { name: '我们的约定', exact: true })).toBeVisible();
  const typesLink = page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '记录类型', exact: true });
  await expect(typesLink).toBeVisible();
  await typesLink.click();
  await expect(page.getByRole('heading', { name: '记录类型', exact: true })).toBeVisible();
  await expect(typesLink).toHaveClass(/active/);
  const catalogue = page.getByRole('region', { name: '当前记录类型' });
  await expect(catalogue.getByRole('article')).toHaveCount(8);
  for (const name of [
    '学校考试',
    '基础试卷',
    '拓展试卷',
    '对长辈大吼大叫',
    '学习相关哭泣',
    '默写全对',
    '主动做家务',
    '跳过课外试卷',
  ]) {
    await expect(catalogue.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  const school = catalogue
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '学校考试', exact: true }) });
  await expect(school).toContainText('A+');
  await expect(school).toContainText('¥200.00');
  const skip = catalogue
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '跳过课外试卷', exact: true }) });
  await expect(skip).toContainText('-10');
  await expect(skip).toContainText('已结算积分');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await catalogue
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: '默写全对', exact: true }) })
    .getByRole('link', { name: '记一笔', exact: true })
    .click();
  await expect(page.getByLabel('事项类型')).toHaveValue('DICTATION');
  await page.goto('/');

  await page.getByRole('link', { name: '记一笔', exact: true }).first().click();
  await page.getByLabel('事项类型').selectOption('DICTATION');
  await page.getByLabel('发生时间').fill('2026-09-20T18:00');
  await page.getByLabel('事项原因').fill('英语单词默写全对');
  await page.getByRole('button', { name: '保存记录' }).click();
  await expect(page.getByText('英语单词默写全对').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '确认这条记录' })).toHaveCount(0);
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'ellie');
  await page.goto('/history');
  await page.getByRole('link', { name: /英语单词默写全对/ }).click();
  await page.getByRole('button', { name: '确认这条记录' }).click();
  await expect(page.getByText('已确认', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('爸爸', { exact: true }).first()).toBeVisible();
  const eventId = new URL(page.url()).pathname.split('/').pop()!;
  for (let i = 0; i < 2; i++) {
    const response = await page.request.post('/api/commands', {
      headers: { origin: 'http://127.0.0.1:3100' },
      form: { action: 'decide', eventId, decision: 'CONFIRM', requestKey: crypto.randomUUID() },
    });
    expect(response.ok()).toBe(true);
  }
  await page.reload();
  await expect(page.getByText('Ellie · 确认', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '确认这条记录' })).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: '商城', exact: true })).toHaveCount(0);
});
test('电脑：管理员生成即确认、用户确认后入账，无需第二管理员', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, 'dad');
  await page.goto('/settlements');
  await page.getByLabel('结算协议月起点').fill('2026-09-18');
  await page.getByRole('button', { name: '生成月度总结' }).click();
  await expect(page.getByRole('heading', { name: '一起核对这个月' })).toBeVisible();
  await expect(page.getByText('无学习哭泣奖励', { exact: true })).toBeVisible();
  const summaryUrl = page.url();
  await expect(page.getByRole('button', { name: '确认本月总结' })).toHaveCount(0);
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'ellie');
  await page.goto(summaryUrl);
  await page.getByRole('button', { name: '确认本月总结' }).click();
  await expect(page.getByRole('button', { name: '确认并更新钱包' })).toHaveCount(0);
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'dad');
  await page.goto(summaryUrl);
  await page.getByRole('button', { name: '确认并更新钱包' }).click();
  await expect(page.getByText('已入账', { exact: true }).first()).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('¥550.00', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'ellie');
  await page.goto('/?subject=not-owned');
  await expect(page.getByText('没有权限访问该记录')).toBeVisible();
});
test('错误登录和跨站写入不泄露数据；Docker配置不公开业务端口', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel('帐号').fill('dad');
  await page.getByLabel('密码', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '帐号或密码错误' })).toBeVisible();
  const response = await request.post('/api/commands', {
    headers: { origin: 'https://evil.example' },
    data: { action: 'setup', anchor: '2026-01-01' },
  });
  expect(response.status()).toBe(403);
  const compose = readFileSync('deploy/compose.yaml', 'utf8');
  expect(compose).toContain('127.0.0.1:3000:3000');
  expect(compose).toContain('unless-stopped');
  expect(compose).toMatch(/max-size:\s*['"]?10m/);
});
test('管理员新增记录类型，按次数录入；普通用户不能维护对应表', async ({ page }) => {
  await login(page, 'dad');
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '记录类型', exact: true })
    .click();
  await page.getByLabel('类型名称').fill('周末阅读奖励');
  await page.getByLabel('每次金钱（元）').fill('12.50');
  await page.getByLabel('每次积分币').fill('2');
  await page.getByRole('button', { name: '新增记录类型' }).click();
  await expect(page.getByText('周末阅读奖励', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '当前记录类型' }).getByRole('article')).toHaveCount(
    9,
  );
  await page.goto('/events/new');
  await page.getByLabel('事项类型').selectOption({ label: '周末阅读奖励' });
  await page.getByLabel('次数').fill('3');
  await page.getByLabel('发生时间').fill('2026-10-20T08:00');
  await page.getByLabel('事项原因').fill('三次阅读记录');
  await page.getByRole('button', { name: '保存记录' }).click();
  await expect(page.getByRole('heading', { name: '周末阅读奖励', exact: true })).toBeVisible();
  await expect(page.getByText('3 次', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'ellie');
  await page.goto('/record-types');
  await expect(page.getByText('周末阅读奖励', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '当前记录类型' }).getByRole('article')).toHaveCount(
    9,
  );
  await expect(page.getByRole('button', { name: '新增记录类型' })).toHaveCount(0);
  await page.goto('/events/new');
  await page.getByLabel('事项类型').selectOption('DICTATION');
  await page.getByLabel('发生时间').fill('2026-10-20T08:00');
  await page.getByLabel('事项原因').fill('用户创建只需一位管理员确认');
  await page.getByRole('button', { name: '保存记录' }).click();
  await expect(page.getByRole('button', { name: '确认这条记录' })).toHaveCount(0);
  await expect(page.getByText('用户创建只需一位管理员确认', { exact: true })).toBeVisible();
  const eventUrl = page.url();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'mom');
  await page.goto(eventUrl);
  await page.getByRole('button', { name: '确认这条记录' }).click();
  await expect(page.getByText('已确认', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '确认这条记录' })).toHaveCount(0);
});
test('历史按协议月和状态筛选，手机仍能访问规则与类型', async ({ page }) => {
  test.setTimeout(15000);
  await login(page, 'ellie');
  await page.goto('/history');
  await page.getByLabel('筛选协议月').fill('2026-09-18');
  await page.getByLabel('筛选状态').selectOption('CONFIRMED');
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await expect(page.getByText('英语单词默写全对', { exact: true })).toBeVisible();
  await expect(page.getByText('三次阅读记录', { exact: true })).toHaveCount(0);
  await page.getByLabel('筛选状态').selectOption('PENDING');
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await expect(page.getByText('英语单词默写全对', { exact: true })).toHaveCount(0);
});
test('家庭成员查看实际协议PDF并下载原始Word，匿名不可获取附件', async ({ page, request }) => {
  expect((await request.get('/api/agreement-file?format=docx')).status()).toBe(401);
  await login(page, 'ellie');
  await page.goto('/agreement');
  await expect(page.getByRole('heading', { name: '协议附件', exact: true })).toBeVisible();
  await expect(page.locator('article')).toContainText('未被其他成员确认的记录可由创建人删除');
  const preview = page.getByRole('link', { name: '在线查看协议', exact: true });
  const pdf = await page.request.get((await preview.getAttribute('href'))!);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await page.getByText('展开协议预览', { exact: true }).click();
  await expect(page.getByTitle('协议 PDF 预览')).toBeVisible();
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: '下载原始 Word', exact: true }).click(),
  ]);
  expect(download[0].suggestedFilename()).toBe('家庭奖惩协议.docx');
  expect(readFileSync((await download[0].path())!)).toEqual(
    readFileSync('uploads/agreements/family-agreement.docx'),
  );
});
test('确认后不再显示沟通表单，之前的沟通原因保留在确认时间线', async ({ page }) => {
  await login(page, 'ellie');
  await page.goto('/events/new');
  await page.getByLabel('事项类型').selectOption('DICTATION');
  await page.getByLabel('发生时间').fill('2026-10-20T08:00');
  await page.getByLabel('事项原因').fill('确认后保留沟通历史');
  await page.getByRole('button', { name: '保存记录' }).click();
  await page.getByLabel('需要沟通的原因').fill('请核对是否是第六课默写');
  await page.getByRole('button', { name: '标记待沟通', exact: true }).click();
  await expect(page.getByText('待沟通', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '确认这条记录', exact: true }).click();
  const eventUrl = page.url();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'dad');
  await page.goto(eventUrl);
  await page.getByRole('button', { name: '确认这条记录', exact: true }).click();
  await expect(page.getByText('已确认', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('需要沟通的原因')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '标记待沟通', exact: true })).toHaveCount(0);
  const timeline = page
    .getByRole('heading', { name: '确认与操作时间线' })
    .locator('..')
    .locator('..');
  await expect(timeline).toContainText('Ellie · 提出异议');
  await expect(timeline).toContainText('沟通原因：请核对是否是第六课默写');
  await expect(timeline).toContainText('Ellie · 确认');
});
async function createLifecycleEvent(page: import('@playwright/test').Page, reason: string) {
  await page.goto('/events/new');
  await page.getByLabel('事项类型').selectOption('DICTATION');
  await page.getByLabel('发生时间').fill('2026-10-20T08:00');
  await page.getByLabel('事项原因').fill(reason);
  await page.getByRole('button', { name: '保存记录' }).click();
  await expect(page.getByText(reason, { exact: true }).first()).toBeVisible();
  return page.url();
}
test('创建人可在他人确认前删除，其他管理员无权删除，确认后关闭删除', async ({ page }) => {
  await login(page, 'dad');
  const deletedUrl = await createLifecycleEvent(page, '无人确认可删除的记录');
  await expect(page.getByText('普通记录', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '删除未确认记录', exact: true }).click();
  await expect(page).toHaveURL(/\/history/);
  await expect(page.getByText('无人确认可删除的记录', { exact: true })).toHaveCount(0);
  const response = await page.goto(deletedUrl);
  expect(response?.status()).toBe(404);
  const lockedUrl = await createLifecycleEvent(page, '他人确认后禁止删除');
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'mom');
  await page.goto(lockedUrl);
  await expect(page.getByRole('button', { name: '删除未确认记录', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '确认这条记录', exact: true }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'dad');
  await page.goto(lockedUrl);
  await expect(page.getByRole('button', { name: '删除未确认记录', exact: true })).toHaveCount(0);
});
test('反向记录明确展示抵销作用和原事项，可以删除无人确认的反向记录', async ({ page }) => {
  await login(page, 'dad');
  await createLifecycleEvent(page, '反向展示的原始事项');
  await page.getByLabel('更正原因').fill('撤销原事项的测试更正');
  await page.getByRole('button', { name: '新增反向记录', exact: true }).click();
  await expect(page.getByText('反向记录', { exact: true })).toBeVisible();
  await expect(page.getByText('这条记录用于抵销原始事项，不是一笔独立奖惩。')).toBeVisible();
  await expect(page.getByRole('link', { name: '反向展示的原始事项', exact: true })).toBeVisible();
  await expect(page.locator('dl')).toContainText('默写全对');
  await expect(page.locator('dl')).toContainText('原记录来源 / 依据');
  await page.getByRole('button', { name: '删除未确认记录', exact: true }).click();
  await expect(page).toHaveURL(/\/history/);
  await expect(page.getByText('撤销原事项的测试更正', { exact: true })).toHaveCount(0);
  await expect(page.getByText('反向展示的原始事项', { exact: true })).toBeVisible();
});

test('暖色改版：主要页面适配手机、平板与电脑，保留规则和失败输入', async ({ page }) => {
  test.setTimeout(120000);
  await login(page, 'dad');
  const routes = [
    '/',
    '/money',
    '/points',
    '/record-types',
    '/history',
    '/events/new',
    '/settlements',
    '/agreement',
  ];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('main h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} should fit ${width}px`,
      ).toBe(true);
      await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
      if (route === '/record-types') {
        const catalogue = page.getByRole('region', { name: '当前记录类型' });
        await expect(catalogue.getByText('事项与规则', { exact: true })).toBeVisible();
        await expect(catalogue.getByRole('article')).toHaveCount(9);
        await expect(catalogue).toContainText('A+：¥200.00');
        await expect(catalogue).toContainText('每自然月最多一次');
      }
      if (width === 390 || width === 1440) {
        const name = route === '/' ? 'dashboard' : route.slice(1).replaceAll('/', '-');
        await page.screenshot({
          path: `test-results/redesign-${name}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/events/new');
  await page.getByLabel('事项原因').fill('保存失败后仍然保留的记录');
  await page.route('**/api/commands', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: '请核对这条记录后再提交' }),
    }),
  );
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '请核对这条记录后再提交' })).toBeVisible();
  await expect(page.getByLabel('事项原因')).toHaveValue('保存失败后仍然保留的记录');
  await page.unroute('**/api/commands');
  await createLifecycleEvent(page, '周末阅读后整理读书笔记，记录今天的新发现。'.repeat(6));
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lastLink = await page
    .getByRole('link', { name: '查看全部记录', exact: true })
    .boundingBox();
  const navigation = await page.getByRole('navigation', { name: '主导航' }).boundingBox();
  expect(lastLink!.y + lastLink!.height).toBeLessThan(navigation!.y);
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'ellie');
  await page.goto('/');
  await expect(page.getByLabel('奖惩对象')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '已结算钱包' })).toBeVisible();
});

test('暖色改版：负余额保留金额符号并正确显示在首页和钱包', async ({ page }) => {
  const db = new Database('data/browser.db');
  const wallet = db
    .prepare(
      'SELECT w.subjectId, w.money FROM Wallet w JOIN User u ON u.id = w.subjectId WHERE u.username = ?',
    )
    .get('ellie') as { subjectId: string; money: number };
  try {
    db.prepare('UPDATE Wallet SET money = ? WHERE subjectId = ?').run(-15000, wallet.subjectId);
    await page.setViewportSize({ width: 320, height: 844 });
    await login(page, 'ellie');
    for (const route of ['/', '/money']) {
      await page.goto(route);
      await expect(page.getByText('-¥150.00', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  } finally {
    db.prepare('UPDATE Wallet SET money = ? WHERE subjectId = ?').run(
      wallet.money,
      wallet.subjectId,
    );
    db.close();
  }
});

test('录入：现代选择框、考试年级和按协议即时预览，同年级可登记多场考试', async ({ page }) => {
  await login(page, 'dad');
  await page.goto('/events/new');
  const preview = page.getByRole('status', { name: '本次预计变化' });
  await expect(page.getByLabel('年级', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('来源或试卷名称')).toHaveCount(0);
  const select = page.getByLabel('事项类型');
  expect(await select.evaluate((e) => getComputedStyle(e).appearance)).toBe('none');
  expect((await select.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(preview).toContainText('增加 +1 积分');
  await select.selectOption('DICTATION');
  await page.getByLabel('次数').fill('3');
  await expect(preview).toContainText('增加 +3 积分');
  await select.selectOption({ label: '周末阅读奖励' });
  await expect(preview).toContainText('增加 +¥37.50');
  await expect(preview).toContainText('增加 +6 积分');
  await select.selectOption('BASIC');
  await expect(page.getByLabel('年级', { exact: true })).toBeVisible();
  await expect(preview).toContainText('填写试卷分数');
  await page.getByLabel('试卷分数').fill('0');
  await expect(preview).toContainText('扣减 -¥300.00');
  await page.getByLabel('试卷分数').fill('85');
  await expect(preview).toContainText('金额和积分均无变化');
  await select.selectOption('ADVANCED');
  await expect(page.getByLabel('年级', { exact: true })).toBeVisible();
  await expect(preview).toContainText('增加 +¥300.00');
  await select.selectOption('SCHOOL');
  await page.getByLabel('成绩等级').selectOption('C');
  await expect(preview).toContainText('扣减 -¥600.00');
  await page.getByLabel('次数').fill('1');
  for (let index = 1; index <= 2; index++) {
    if (index === 2) await page.goto('/events/new?type=SCHOOL');
    await page.getByLabel('年级', { exact: true }).selectOption('三年级上');
    await page.getByLabel('事项原因').fill('同年级考试验证' + index);
    await page.getByRole('button', { name: '保存记录', exact: true }).click();
    await expect(page.locator('dl')).toContainText('三年级上');
    await expect(page.getByText('同年级考试验证' + index, { exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/events/new?type=ADVANCED');
  await page.getByLabel('年级', { exact: true }).selectOption('四年级下');
  await page.getByLabel('试卷分数').fill('55');
  await page.screenshot({ path: 'test-results/event-preview-mobile.png', fullPage: true });
});

test('大吼大叫选择六种对象，保存后可查看且其他事项不显示对象', async ({ page }) => {
  await login(page, 'dad');
  await page.goto('/events/new');
  await expect(page.getByLabel('对象', { exact: true })).toHaveCount(0);
  await page.getByLabel('事项类型').selectOption('SHOUT');
  const target = page.getByLabel('对象', { exact: true });
  await expect(target).toBeVisible();
  await expect(target.locator('option')).toHaveText([
    '请选择对象',
    '爷爷',
    '奶奶',
    '爸爸',
    '妈妈',
    '姑姑',
    '其他',
  ]);
  expect(await target.evaluate((e: HTMLSelectElement) => e.validity.valueMissing)).toBe(true);
  await page.getByLabel('次数').fill('2');
  await expect(page.getByRole('status', { name: '本次预计变化' })).toContainText('扣减 -¥200.00');
  for (const name of ['爷爷', '其他']) {
    if (name === '其他') await page.goto('/events/new?type=SHOUT');
    await page.getByLabel('对象', { exact: true }).selectOption(name);
    await page.getByLabel('事项原因').fill('对象保存验证：' + name);
    await page.getByRole('button', { name: '保存记录', exact: true }).click();
    await expect(page.locator('dl').filter({ hasText: '事项次数' })).toContainText('对象');
    await expect(
      page.locator('dd').filter({ hasText: new RegExp('^' + name + '$') }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator('dd').filter({ hasText: new RegExp('^' + name + '$') }),
    ).toBeVisible();
  }
  const invalid = await page.request.post('/api/commands', {
    headers: { origin: 'http://127.0.0.1:3100' },
    form: {
      action: 'record',
      type: 'SHOUT',
      occurredAt: '2026-10-20T12:00',
      quantity: '1',
      reason: '非法对象不应保存',
      shoutTarget: '无效选项',
      requestKey: crypto.randomUUID(),
    },
  });
  expect(invalid.status()).toBe(400);
  const nonShout = await page.request.post('/api/commands', {
    headers: { origin: 'http://127.0.0.1:3100' },
    form: {
      action: 'record',
      type: 'DICTATION',
      occurredAt: '2026-10-20T12:00',
      quantity: '1',
      reason: '非大吼记录不保存对象',
      shoutTarget: '爷爷',
      requestKey: crypto.randomUUID(),
    },
  });
  expect(nonShout.ok()).toBe(true);
  await page.goto((await nonShout.json()).redirect);
  await expect(page.locator('dt').filter({ hasText: /^对象$/ })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/events/new?type=SHOUT');
  await page.getByLabel('对象', { exact: true }).selectOption('其他');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/shout-target-mobile.png', fullPage: true });
});

test('钱包事项与新建和历史入口区分资产，双资产与反向只显示本页增减', async ({ page }) => {
  await login(page, 'dad');
  const db = new Database('data/browser.db');
  const subject = (
    db.prepare('SELECT id FROM User WHERE username = ?').get('wallet') as { id: string }
  ).id;
  const headers = { origin: 'http://127.0.0.1:3100' };
  const definitions = [
    { name: '只改金额的事项', money: '25', points: '0' },
    { name: '只改积分的事项', money: '0', points: '3' },
    { name: '同时改变金额和积分', money: '12', points: '2' },
  ];
  for (const definition of definitions) {
    expect(
      (
        await page.request.post('/api/commands', {
          headers,
          form: { action: 'create-type', ...definition },
        })
      ).ok(),
    ).toBe(true);
  }
  const types = db.prepare('SELECT code,name FROM RecordType').all() as {
    code: string;
    name: string;
  }[];
  db.close();
  async function record(type: string, reason: string, extra = {}) {
    const response = await page.request.post('/api/commands', {
      headers,
      form: {
        action: 'record',
        subjectId: subject,
        type,
        reason,
        occurredAt: '2026-10-20T12:00',
        quantity: '1',
        requestKey: crypto.randomUUID(),
        ...extra,
      },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()).redirect.split('/').pop();
  }
  await record('SCHOOL', '学校A金额记录', { grade: 'A', schoolYear: '三年级上' });
  await record('BASIC', '基础85分零金额记录', { score: '85', schoolYear: '三年级上' });
  await record('DICTATION', '默写积分记录');
  for (const definition of definitions) {
    const id = await record(types.find((t) => t.name === definition.name)!.code, definition.name);
    if (definition.name === '同时改变金额和积分') {
      expect(
        (
          await page.request.post('/api/commands', {
            headers,
            form: {
              action: 'reverse',
              eventId: id,
              reason: '双资产更正',
              requestKey: crypto.randomUUID(),
            },
          })
        ).ok(),
      ).toBe(true);
    }
  }
  for (const asset of ['MONEY', 'POINTS']) {
    const points = asset === 'POINTS';
    await page.goto((points ? '/points' : '/money') + '?subject=' + subject);
    const rows = page.locator('.records-panel').first();
    await expect(rows).toContainText(points ? '默写积分记录' : '学校A金额记录');
    await expect(rows).not.toContainText(points ? '学校A金额记录' : '默写积分记录');
    await expect(rows).toContainText(points ? '只改积分的事项' : '只改金额的事项');
    await expect(rows).not.toContainText(points ? '只改金额的事项' : '只改积分的事项');
    if (!points) await expect(rows).toContainText('基础85分零金额记录');
    const dual = rows.getByRole('link', { name: /同时改变金额和积分/ }).locator('.event-change');
    await expect(dual).toContainText(points ? '+2 积分' : '+¥12.00');
    await expect(dual).not.toContainText(points ? '¥' : '积分');
    await expect(
      rows.getByRole('link', { name: /双资产更正/ }).locator('.event-change'),
    ).toContainText(points ? '-2 积分' : '-¥12.00');
    const newLink = await page
      .getByRole('link', { name: '记一笔', exact: true })
      .getAttribute('href');
    const historyLink = await page
      .getByRole('link', { name: '完整历史', exact: true })
      .getAttribute('href');
    expect(new URL(newLink!, 'http://localhost').searchParams.get('asset')).toBe(asset);
    expect(new URL(historyLink!, 'http://localhost').searchParams.get('asset')).toBe(asset);
    await page.goto(newLink!);
    const options = page.getByLabel('事项类型').locator('option');
    await expect(options.filter({ hasText: points ? '主动做家务' : '学校考试' })).toHaveCount(1);
    await expect(options.filter({ hasText: points ? '学校考试' : '主动做家务' })).toHaveCount(0);
    await expect(
      options.filter({ hasText: points ? '只改金额的事项' : '只改积分的事项' }),
    ).toHaveCount(0);
    await expect(options.filter({ hasText: '同时改变金额和积分' })).toHaveCount(1);
    await page.goto(historyLink!);
    await expect(
      page.getByRole('heading', { name: points ? '积分记录' : '金钱记录', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '筛选', exact: true }).click();
    expect(new URL(page.url()).searchParams.get('asset')).toBe(asset);
    await page.getByRole('button', { name: '切换', exact: true }).click();
    expect(new URL(page.url()).searchParams.get('asset')).toBe(asset);
    await expect(page.locator('.event-list')).not.toContainText(
      points ? '学校A金额记录' : '默写积分记录',
    );
    await page.screenshot({
      path: `test-results/wallet-${asset.toLowerCase()}-history.png`,
      fullPage: true,
    });
  }
});

test('首页分离月奖励与记录净额，积分和无哭泣原因可追溯，列表显示增减', async ({ page }) => {
  const db = new Database('data/browser.db');
  const child = db.prepare('SELECT id FROM User WHERE username = ?').get('preview') as {
    id: string;
  };
  db.close();
  await login(page, 'dad');
  const occurredAt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(Date.now() - 60000))
    .replace(' ', 'T');
  const ids: string[] = [];
  async function record(type: string, reason: string, extra = {}) {
    const response = await page.request.post('/api/commands', {
      headers: { origin: 'http://127.0.0.1:3100' },
      form: {
        action: 'record',
        subjectId: child.id,
        type,
        reason,
        occurredAt,
        quantity: '1',
        requestKey: crypto.randomUUID(),
        ...extra,
      },
    });
    expect(response.ok()).toBe(true);
    const { redirect } = await response.json();
    const id = redirect.split('/').pop() as string;
    ids.push(id);
    return id;
  }
  await record('ADVANCED', '英语拓展55分', { score: '55', schoolYear: '三年级上' });
  await record('SCHOOL', '语文习作A', { grade: 'A', schoolYear: '三年级上' });
  await record('ADVANCED', '拓展40分', { score: '40', schoolYear: '三年级上' });
  await record('BASIC', '数学基础79分', { score: '79', schoolYear: '三年级上' });
  await record('DICTATION', '默写加一分');
  const cry = await record('CRY', '数学题不会做，因学习困难哭泣');
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'preview');
  const bonus = page.getByRole('region', { name: '完整协议月无学习哭泣' });
  await expect(bonus).toContainText('待核对');
  async function confirm(id: string) {
    const response = await page.request.post('/api/commands', {
      headers: { origin: 'http://127.0.0.1:3100' },
      form: { action: 'decide', eventId: id, decision: 'CONFIRM', requestKey: crypto.randomUUID() },
    });
    expect(response.ok()).toBe(true);
  }
  for (const id of ids.filter((id) => id !== cry)) await confirm(id);
  await page.reload();
  const estimate = page.getByRole('region', { name: '本月预计变化' });
  await expect(estimate).toContainText('-¥200.00');
  await expect(estimate).toContainText('+1');
  await expect(estimate).toContainText('不含月度奖励');
  for (const route of ['/money', '/points']) {
    await page.goto(route);
    await expect(page.locator('.wallet-overview-note')).toContainText(
      route === '/money' ? '-¥200.00' : '+1 积分',
    );
  }
  await confirm(cry);
  await page.goto('/');
  await expect(bonus).toContainText('本月不满足');
  await bonus.getByText('查看不满足原因', { exact: false }).click();
  const reasonLink = bonus.getByRole('link', { name: /数学题不会做/ });
  await expect(reasonLink).toBeVisible();
  await expect(reasonLink).toHaveAttribute('href', '/events/' + cry);
  await expect(reasonLink).toContainText(occurredAt.slice(0, 10));
  await page.goto('/history');
  await expect(page.getByText('预计增减', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /语文习作A/ })).toContainText('增加 +¥100.00');
  await expect(page.getByRole('link', { name: /默写加一分/ })).toContainText('增加 +1 积分');
  await expect(page.getByRole('link', { name: /数学基础79分/ })).toContainText('扣减 -¥100.00');
  await page.goto('/events/' + cry);
  await page.getByLabel('更正原因').fill('记录认定有误');
  await page.getByRole('button', { name: '新增反向记录', exact: true }).click();
  await page.goto('/history');
  await expect(page.getByRole('link', { name: /记录认定有误/ })).toContainText('增加 +¥100.00');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/history']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (route === '/history') {
        const cell = await page.locator('.event-change').first().boundingBox();
        const amount = await page.locator('.event-change .impact-values').first().boundingBox();
        expect(
          Math.abs(amount!.x + amount!.width / 2 - cell!.x - cell!.width / 2),
        ).toBeLessThanOrEqual(1);
        if (width >= 768) {
          const row = await page.locator('.event-row').first().boundingBox();
          expect(Math.abs(cell!.x + cell!.width / 2 - row!.x - row!.width / 2)).toBeLessThanOrEqual(
            row!.width * 0.08,
          );
        }
      }
      if (route === '/') await bonus.getByText('查看不满足原因', { exact: false }).click();
      await page.screenshot({
        path: `test-results/preview-${route === '/' ? 'dashboard' : 'history'}-${width}.png`,
        fullPage: true,
      });
    }
  }
});
