import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase } from '../support/database';
import { Accounts } from '../../src/server/accounts';
import { Family } from '../../src/services/family';
import { createMiniHandler } from '../../src/server/mini-api';

const fixture = testDatabase();
const password = 'mini-test-password-123';
let handle: ReturnType<typeof createMiniHandler>;
let dad: string, child: string, dadToken: string, childToken: string;
let eventId: string, summaryId: string;
function request(method: string, data: Record<string, unknown> = {}, token = '') {
  const query = new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)]));
  return handle(
    new Request('http://localhost/api/mini' + (method === 'GET' ? '?' + query : ''), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(data) } : {}),
    }),
  );
}
async function get(data: Record<string, unknown>, token = dadToken) {
  const response = await request('GET', data, token);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  return response.json();
}
async function post(data: Record<string, unknown>, token = dadToken) {
  const response = await request('POST', data, token);
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
  return response.json();
}
beforeAll(async () => {
  await fixture.init();
  const accounts = new Accounts(fixture.db);
  dad = (await accounts.create('dad', '爸爸', 'ADMIN', password, 0, 0)).id;
  child = (await accounts.create('child', '孩子', 'USER', password, 0, 20)).id;
  handle = createMiniHandler(fixture.db);
  dadToken = (await post({ action: 'login', username: 'dad', password }, '')).token;
  childToken = (await post({ action: 'login', username: 'child', password }, '')).token;
});
afterAll(() => fixture.close());
describe('小程序与 Web 共用后端', () => {
  it('独立 Bearer 登录，无 Cookie/Origin 依赖，不返回密码或会话哈希', async () => {
    expect(await new Accounts(fixture.db).resolve(dadToken)).toMatchObject({ id: dad });
    const login = await post({ action: 'login', username: 'child', password }, '');
    expect(login.user).toEqual({ id: child, name: '孩子', username: 'child', role: 'USER' });
    expect(JSON.stringify(login)).not.toContain('passwordHash');
    expect(
      (await request('POST', { action: 'login', username: 'dad', password: 'wrong' })).status,
    ).toBe(400);
    expect((await request('GET', { resource: 'dashboard' })).status).toBe(401);
  });
  it('首次设置由管理员执行，普通用户仅看本人', async () => {
    expect((await get({ resource: 'dashboard' })).needsSetup).toBe(true);
    expect(
      (await request('POST', { action: 'setup', anchor: '2026-09-18' }, childToken)).status,
    ).toBe(403);
    await post({ action: 'setup', anchor: '2026-09-18' });
    const dashboard = await get({ resource: 'dashboard' }, childToken);
    expect(dashboard.users).toHaveLength(1);
    expect(dashboard.subject.id).toBe(child);
    expect((await request('GET', { resource: 'dashboard', subject: dad }, childToken)).status).toBe(
      403,
    );
    expect((await request('GET', { resource: 'history', subject: dad }, childToken)).status).toBe(
      403,
    );
  });
  it('共享类型、金额预览及范围，非法预览明确失败', async () => {
    await post({ action: 'create-type', name: '共同阅读', money: 100, points: 2 });
    const types = await get({ resource: 'types', asset: 'POINTS' });
    expect(types.types.some((t: { code: string }) => t.code === 'SCHOOL')).toBe(false);
    expect(types.types.some((t: { name: string }) => t.name === '共同阅读')).toBe(true);
    expect(
      (await get({ resource: 'preview', type: 'BASIC', score: 79, quantity: 2 })).impact,
    ).toEqual({ money: -20000, points: 0 });
    expect(
      (await request('GET', { resource: 'preview', type: 'BASIC', score: '' }, dadToken)).status,
    ).toBe(400);
    expect(
      (await request('GET', { resource: 'preview', type: 'BASIC', score: 101 }, dadToken)).status,
    ).toBe(400);
  });
  it('JSON 登记重试只写一次，网页服务可见，钱包未入账不变', async () => {
    const input = {
      action: 'record',
      subjectId: child,
      type: 'DICTATION',
      occurredAt: '2026-09-20T18:00:00+08:00',
      quantity: 1,
      reason: '小程序默写',
      requestKey: crypto.randomUUID(),
      evidence: {},
    };
    eventId = (await post(input)).id;
    expect((await post(input)).id).toBe(eventId);
    expect(
      (await new Family(fixture.db).history({ id: dad, role: 'ADMIN' }, child)).some(
        (e) => e.id === eventId,
      ),
    ).toBe(true);
    expect((await get({ resource: 'dashboard', subject: child })).wallet.points).toBe(20);
    const points = await get({ resource: 'history', subject: child, asset: 'POINTS' });
    expect(points.events[0]).toMatchObject({ id: eventId, impact: { money: 0, points: 1 } });
    expect(
      (await get({ resource: 'history', subject: child, asset: 'MONEY' })).events,
    ).toHaveLength(0);
    expect(
      (
        await request(
          'POST',
          { ...input, requestKey: crypto.randomUUID(), subjectId: dad },
          childToken,
        )
      ).status,
    ).toBe(403);
  });
  it('考试和大吼对象在边界解析，历史可按类型状态筛选', async () => {
    const input = {
      action: 'record',
      subjectId: child,
      type: 'SHOUT',
      occurredAt: '2026-09-21T18:00:00+08:00',
      quantity: 1,
      reason: '沟通',
      requestKey: crypto.randomUUID(),
      evidence: {},
    };
    expect((await request('POST', input, dadToken)).status).toBe(400);
    const shout = await post({ ...input, evidence: { shoutTarget: '妈妈' } });
    const list = await get({ resource: 'history', type: 'SHOUT', status: 'PENDING' });
    expect(list.events.map((e: { id: string }) => e.id)).toEqual([shout.id]);
    await post({ action: 'delete-event', eventId: shout.id });
  });
  it('本人确认、原始时间线和删除权限保持一致', async () => {
    await post(
      { action: 'decide', eventId, decision: 'CONFIRM', requestKey: crypto.randomUUID() },
      childToken,
    );
    const detail = await get({ resource: 'event', id: eventId });
    expect(detail.event.status).toBe('CONFIRMED');
    expect(detail.canDelete).toBe(false);
    expect(detail.canDispute).toBe(false);
    expect(detail.event.decisions).toHaveLength(1);
    expect((await request('POST', { action: 'delete-event', eventId }, dadToken)).status).toBe(400);
  });
  it('反向更正后双方确认抵销原记录', async () => {
    const reversal = await post({
      action: 'reverse',
      eventId,
      reason: '更正重复',
      requestKey: crypto.randomUUID(),
    });
    expect(
      (await get({ resource: 'dashboard', subject: child })).pending.some(
        (e: { id: string }) => e.id === reversal.id,
      ),
    ).toBe(true);
    await post(
      {
        action: 'decide',
        eventId: reversal.id,
        decision: 'CONFIRM',
        requestKey: crypto.randomUUID(),
      },
      childToken,
    );
    expect((await get({ resource: 'event', id: eventId })).event.status).toBe('REVERSED');
  });
  it('总结生成、本人确认、重复入账只更新一次，网页服务读到同一钱包', async () => {
    summaryId = (await post({ action: 'generate', subjectId: child, start: '2026-09-18' })).id;
    const summary = await get({ resource: 'settlement', id: summaryId });
    expect(summary.canPost).toBe(false);
    expect((await get({ resource: 'settlements', subject: child })).settlements[0].id).toBe(
      summaryId,
    );
    await post({ action: 'confirm-summary', id: summaryId }, childToken);
    expect((await get({ resource: 'settlement', id: summaryId })).canPost).toBe(true);
    await post({ action: 'post', id: summaryId });
    const wallet = await fixture.db.wallet.findUniqueOrThrow({ where: { subjectId: child } });
    await post({ action: 'post', id: summaryId });
    expect(await fixture.db.wallet.findUniqueOrThrow({ where: { subjectId: child } })).toEqual(
      wallet,
    );
    expect(wallet).toMatchObject({ money: 50000, points: 20 });
  });
  it('协议需要认证，缺失文件返回 404，未知格式和操作返回 400', async () => {
    expect((await request('GET', { resource: 'agreement', format: 'pdf' })).status).toBe(401);
    expect((await request('GET', { resource: 'agreement', format: 'exe' }, dadToken)).status).toBe(
      400,
    );
    const files = createMiniHandler(fixture.db, {
      agreementDirectory: '/tmp/family-mini-missing-agreement',
    });
    expect(
      (
        await files(
          new Request('http://localhost/api/mini?resource=agreement', {
            headers: { Authorization: 'Bearer ' + dadToken },
          }),
        )
      ).status,
    ).toBe(404);
    expect((await request('POST', { action: 'unknown' }, dadToken)).status).toBe(400);
  });
  it('事实改变后总结失效，旧确认不能入账，次数使用业务名称', async () => {
    const user = await new Accounts(fixture.db).create('stale', '总结验证', 'USER', password, 0, 0);
    const login = await post({ action: 'login', username: 'stale', password }, '');
    const input = {
      action: 'record',
      subjectId: user.id,
      type: 'DICTATION',
      occurredAt: '2026-09-22T18:00:00+08:00',
      quantity: 1,
      reason: '总结前的事实',
      evidence: {},
      requestKey: crypto.randomUUID(),
    };
    const event = await post(input);
    await post(
      { action: 'decide', eventId: event.id, decision: 'CONFIRM', requestKey: crypto.randomUUID() },
      login.token,
    );
    const summary = await post({ action: 'generate', subjectId: user.id, start: '2026-09-18' });
    expect((await get({ resource: 'settlement', id: summary.id })).counts).toEqual([
      { code: 'DICTATION', label: '默写全对', count: 1 },
    ]);
    await post({ action: 'confirm-summary', id: summary.id }, login.token);
    await post({ ...input, requestKey: crypto.randomUUID(), reason: '之后补记的事实' });
    const detail = await get({ resource: 'settlement', id: summary.id });
    expect(detail).toMatchObject({ stale: true, canConfirm: false, canPost: false });
    expect((await request('POST', { action: 'post', id: summary.id }, dadToken)).status).toBe(400);
    expect(
      (await fixture.db.wallet.findUniqueOrThrow({ where: { subjectId: user.id } })).money,
    ).toBe(0);
  });
  it('退出或过期会话无法继续读取', async () => {
    const login = await post({ action: 'login', username: 'dad', password }, '');
    await post({ action: 'logout' }, login.token);
    expect((await request('GET', { resource: 'dashboard' }, login.token)).status).toBe(401);
    const expired = await post({ action: 'login', username: 'dad', password }, '');
    const { createHash } = await import('node:crypto');
    await fixture.db.session.update({
      where: { id: createHash('sha256').update(expired.token).digest('hex') },
      data: { expiresAt: new Date(0) },
    });
    expect((await request('GET', { resource: 'dashboard' }, expired.token)).status).toBe(401);
  });
});
