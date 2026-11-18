import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: '家庭成长站 · Family Rewards', template: '%s · 家庭成长站' },
  description: '记录每一次进步，认真对待每一个约定。',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
