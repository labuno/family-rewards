import Link from 'next/link';
import { Suspense } from 'react';
import { Sparkles, BookOpen, LogOut, ShieldCheck, Heart } from 'lucide-react';
import { Navigation } from './navigation';
import { CommandForm } from './command-form';
import { Button } from './ui/button';
type User = { id: string; name: string; role: string };
export function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Sparkles size={24} />
          </span>
          <span>
            家庭成长站<small>温暖记录每一天</small>
          </span>
        </Link>
        <p className="sidebar-label">一起，把成长变成日常</p>
        <Suspense>
          <Navigation />
        </Suspense>
        <div className="sidebar-bottom">
          <Link className="quiet-link" href="/agreement">
            <BookOpen size={18} />
            我们的约定
          </Link>
          <div className="sidebar-note">
            <Heart size={20} />
            <p>
              每一次小小的进步，
              <br />
              都值得认真看见。
            </p>
          </div>
          <div className="account">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role === 'ADMIN' ? '管理员' : '家庭成员'}</small>
            </div>
            <CommandForm>
              <input type="hidden" name="action" value="logout" />
              <button className="icon-button" aria-label="退出登录">
                <LogOut size={18} />
              </button>
            </CommandForm>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link href="/" className="topbar-title">
            <span className="brand-mark">
              <Sparkles size={20} />
            </span>
            <span>
              家庭成长站<small>温暖记录每一天 · 契约与公约</small>
            </span>
          </Link>
          <span className="private-label">
            <ShieldCheck size={15} /> 私密家庭空间
          </span>
          <div className="mobile-account">
            <span className="mobile-user">
              <span className="status-dot" />
              {user.name}
              <small>{user.role === 'ADMIN' ? '管理员' : '家庭成员'}</small>
            </span>
            <Link href="/agreement" className="icon-button" aria-label="我们的约定">
              <BookOpen size={18} />
            </Link>
            <CommandForm>
              <input type="hidden" name="action" value="logout" />
              <button className="icon-button" aria-label="退出登录">
                <LogOut size={16} />
              </button>
            </CommandForm>
          </div>
        </header>
        <main className="main-content">{children}</main>
        <footer className="page-footer">
          一起记录，一起成长 <span>Family Rewards</span>
        </footer>
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function SubjectPicker({
  users,
  current,
  asset,
}: {
  users: User[];
  current: string;
  asset?: 'MONEY' | 'POINTS';
}) {
  return (
    <form method="GET" className="subject-picker">
      {asset && <input type="hidden" name="asset" value={asset} />}
      <label htmlFor="subject-picker">查看成员</label>
      <select id="subject-picker" name="subject" defaultValue={current} aria-label="奖惩对象">
        {users.map((u) => (
          <option value={u.id} key={u.id}>
            {u.name}
            {u.role === 'ADMIN' ? ' · 管理员' : ''}
          </option>
        ))}
      </select>
      <Button variant="outline">切换</Button>
    </form>
  );
}
export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <Sparkles size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
