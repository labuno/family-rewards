import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Database } from './db';
import { requireAdmin, type Actor } from './permissions';
import { parseDay } from '../domain/periods';
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function matches(password: string, hash: string) {
  const [salt, key] = hash.split(':');
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export class Accounts {
  constructor(private db: Database) {}
  async setup(actor: Actor, anchor: string) {
    requireAdmin(actor);
    parseDay(anchor);
    return this.db.$transaction(async (tx) => {
      const previous = await tx.setting.findUnique({ where: { id: 1 } });
      if (previous) {
        if (previous.anchor !== anchor) throw new Error('协议月起点已设置，不可覆盖');
        return previous;
      }
      const setting = await tx.setting.create({ data: { id: 1, anchor, actorId: actor.id } });
      await tx.audit.create({
        data: { actorId: actor.id, action: 'PERIOD_SETUP', objectId: 'settings', detail: anchor },
      });
      return setting;
    });
  }
  async create(
    username: string,
    name: string,
    role: string,
    password: string,
    money: number,
    points: number,
  ) {
    if (
      !/^[a-zA-Z0-9_-]{2,40}$/.test(username) ||
      !name.trim() ||
      !['ADMIN', 'USER'].includes(role) ||
      password.length < 12 ||
      !Number.isSafeInteger(money) ||
      !Number.isSafeInteger(points) ||
      points < 0
    )
      throw new Error('帐号资料或初始余额无效；密码至少 12 位');
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username, name, role, passwordHash: hashPassword(password) },
      });
      await tx.wallet.create({ data: { subjectId: user.id, money, points } });
      for (const [asset, delta] of [
        ['MONEY', money],
        ['POINTS', points],
      ] as const)
        await tx.walletEntry.create({
          data: {
            subjectId: user.id,
            asset,
            before: 0,
            delta,
            after: delta,
            settlementId: 'opening:' + user.id,
            actorId: 'database-operator',
          },
        });
      await tx.audit.create({
        data: {
          actorId: 'database-operator',
          action: 'ACCOUNT_CREATED',
          objectId: user.id,
          detail: JSON.stringify({ username, role, money, points }),
        },
      });
      return user;
    });
  }
  async login(username: string, password: string) {
    const user = await this.db.user.findUnique({ where: { username } });
    // Equal-cost check for unknown accounts avoids an immediate account-existence response.
    const valid = matches(
      password,
      user?.passwordHash ??
        'invalidsalt:' + scryptSync('invalid-password', 'invalidsalt', 64).toString('hex'),
    );
    if (!user?.active || !valid) {
      await this.db.audit.create({
        data: {
          actorId: user?.id,
          action: 'LOGIN_FAILED',
          objectId: username.slice(0, 40),
          detail: '帐号或密码不正确',
        },
      });
      throw new Error('帐号或密码错误');
    }
    const token = randomBytes(32).toString('hex');
    await this.db.$transaction(async (tx) => {
      await tx.session.create({
        data: {
          id: tokenHash(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      await tx.audit.create({
        data: { actorId: user.id, action: 'LOGIN', objectId: user.id, detail: '登录成功' },
      });
    });
    return {
      user: { id: user.id, name: user.name, username: user.username, role: user.role },
      token,
    };
  }
  async resolve(token: string) {
    const session = await this.db.session.findUnique({ where: { id: tokenHash(token) } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    const user = await this.db.user.findUnique({ where: { id: session.userId } });
    return user?.active
      ? { id: user.id, name: user.name, username: user.username, role: user.role }
      : null;
  }
  async logout(token: string) {
    const id = tokenHash(token);
    const session = await this.db.session.findUnique({ where: { id } });
    if (!session || session.revokedAt) return;
    await this.db.$transaction(async (tx) => {
      await tx.session.update({ where: { id }, data: { revokedAt: new Date() } });
      await tx.audit.create({
        data: {
          actorId: session.userId,
          action: 'LOGOUT',
          objectId: session.userId,
          detail: '退出登录',
        },
      });
    });
  }
}
