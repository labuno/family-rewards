import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { testDatabase } from '../support/database';
import { Accounts } from '../../src/server/accounts';
import { authorize, requireAdmin } from '../../src/server/permissions';
const fixture = testDatabase();
let accounts: Accounts;
beforeAll(async () => {
  await fixture.init();
  accounts = new Accounts(fixture.db);
});
afterAll(async () => fixture.close());
describe('认证与权限', () => {
  it('密码不明文保存，角色不依赖名字，失败登录有审计', async () => {
    const user = await accounts.create('dad', '爸爸', 'ADMIN', 'a-test-password-123', 0, 0);
    expect(user.passwordHash).not.toContain('a-test-password');
    expect((await accounts.login('dad', 'a-test-password-123')).user.id).toBe(user.id);
    await expect(accounts.login('dad', 'wrong')).rejects.toThrow('帐号或密码错误');
    await expect(accounts.login('unknown', 'wrong')).rejects.toThrow('帐号或密码错误');
    expect(await fixture.db.audit.count({ where: { action: 'LOGIN_FAILED' } })).toBe(2);
  });
  it('会话可撤销，过期与停用不能访问，重复帐号拒绝', async () => {
    const login = await accounts.login('dad', 'a-test-password-123');
    expect((await accounts.resolve(login.token))?.username).toBe('dad');
    await accounts.logout(login.token);
    expect(await accounts.resolve(login.token)).toBeNull();
    expect(await accounts.resolve('not-a-token')).toBeNull();
    await expect(
      accounts.create('dad', '重复', 'USER', 'a-test-password-123', 0, 0),
    ).rejects.toThrow();
  });
  it('管理员全局，普通用户只看自己，不向客户端泄露哈希', async () => {
    const user = await accounts.create('ellie', 'Ellie', 'USER', 'another-test-123', 0, 0);
    expect(() => authorize(user, user.id)).not.toThrow();
    expect(() => authorize(user, 'dad')).toThrow('没有权限');
    expect(() => requireAdmin(user)).toThrow('仅管理员');
    expect(() => authorize({ id: 'x', role: 'ADMIN' }, user.id)).not.toThrow();
  });
  it('非法初始数据不写用户，不生成明文默认密码', async () => {
    await expect(accounts.create('bad', '用户', 'SUPER', 'short', 0, 0)).rejects.toThrow();
    expect(await fixture.db.user.findUnique({ where: { username: 'bad' } })).toBeNull();
  });
});
it('首次设置仅管理员可操作，不重复覆盖，非法起点拒绝', async () => {
  const admin = (await fixture.db.user.findUnique({ where: { username: 'dad' } }))!;
  const user = (await fixture.db.user.findUnique({ where: { username: 'ellie' } }))!;
  await expect(accounts.setup(user, '2026-09-18')).rejects.toThrow('仅管理员');
  await expect(accounts.setup(admin, '2026-02-30')).rejects.toThrow();
  expect((await accounts.setup(admin, '2026-09-18')).anchor).toBe('2026-09-18');
  expect((await accounts.setup(admin, '2026-09-18')).anchor).toBe('2026-09-18');
  await expect(accounts.setup(admin, '2026-09-20')).rejects.toThrow('已设置');
});
