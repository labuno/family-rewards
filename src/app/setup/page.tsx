import { redirect } from 'next/navigation';
import { CalendarDays, Sparkles } from 'lucide-react';
import { requireUser } from '../../server/session';
import { database } from '../../server/db';
import { CommandForm } from '../../components/command-form';
import { Button } from '../../components/ui/button';
export const dynamic = 'force-dynamic';
export default async function Setup() {
  const user = await requireUser();
  if (await database().setting.findUnique({ where: { id: 1 } })) redirect('/');
  return (
    <div className="setup-page">
      <section className="panel setup-panel">
        <span className="brand-mark">
          <Sparkles size={30} />
        </span>
        <p className="eyebrow">从今天开始，一起记录</p>
        <h1>从一个约定开始</h1>
        <p className="muted">选择第一个协议月的起点。以后的每个月，都会沿用这个日期。</p>
        {user.role === 'ADMIN' ? (
          <CommandForm>
            <input name="action" value="setup" type="hidden" />
            <label htmlFor="anchor">第一个协议月起点</label>
            <input id="anchor" name="anchor" type="date" required />
            <p className="form-hint">
              <CalendarDays size={16} /> 例如 10 月 18 日至 11 月 18 日；设置后不能直接覆盖。
            </p>
            <Button>开启家庭成长站</Button>
          </CommandForm>
        ) : (
          <p className="notice">请等待管理员完成首次设置。</p>
        )}
      </section>
    </div>
  );
}
