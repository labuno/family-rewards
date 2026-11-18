'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutDashboard, Wallet, Sparkles, Shapes } from 'lucide-react';
export function Navigation() {
  const path = usePathname(),
    search = useSearchParams();
  const subject = search.get('subject');
  return (
    <nav className="main-nav" aria-label="主导航">
      {[
        { href: '/', label: '首页', icon: LayoutDashboard },
        { href: '/money', label: '金钱', icon: Wallet },
        { href: '/points', label: '积分', icon: Sparkles },
        { href: '/record-types', label: '记录类型', icon: Shapes },
      ].map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href + (subject ? '?subject=' + encodeURIComponent(subject) : '')}
          className={path === href ? 'nav-item active' : 'nav-item'}
          aria-current={path === href ? 'page' : undefined}
        >
          <Icon size={20} />
          <span>{label}</span>
          {path === href && <span className="nav-dot" />}
        </Link>
      ))}
    </nav>
  );
}
