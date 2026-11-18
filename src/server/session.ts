import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Accounts } from './accounts';
import { database } from './db';
export async function browserSession() {
  const password = process.env.SESSION_PASSWORD;
  if (!password || password.length < 32)
    throw new Error('请在受保护环境配置至少 32 位 SESSION_PASSWORD');
  return getIronSession<{ token?: string }>(await cookies(), {
    password,
    cookieName: 'family-rewards',
    ttl: 7 * 86400,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax',
      path: '/',
    },
  });
}
export async function currentUser() {
  const session = await browserSession();
  return session.token ? new Accounts(database()).resolve(session.token) : null;
}
export async function requireUser() {
  const actor = await currentUser();
  if (!actor) redirect('/login');
  return actor;
}
