import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
export default function Denied() {
  return (
    <section className="panel error-page">
      <ShieldCheck size={30} />
      <h1>这是另一位成员的空间</h1>
      <p>没有权限访问该记录</p>
      <Link href="/">返回自己的看板</Link>
    </section>
  );
}
