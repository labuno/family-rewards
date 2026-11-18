import { redirect } from 'next/navigation';
import { ArrowUpRight, Sparkles, Check, Heart } from 'lucide-react';
import { currentUser } from '../../server/session';
import { CommandForm } from '../../components/command-form';
import { Button } from '../../components/ui/button';
export const dynamic = 'force-dynamic';
export default async function Login() {
  if (await currentUser()) redirect('/');
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles />
          </span>
          <span>
            家庭成长站<small>温暖记录每一天</small>
          </span>
        </div>
        <div className="story-copy">
          <span className="pill">
            <Heart size={14} /> 给成长，多一点看见
          </span>
          <h1>
            小小的进步，
            <br />
            也有大大的意义<span>。</span>
          </h1>
          <p>
            把每一份努力、每一个约定，
            <br />
            变成一家人共同珍藏的成长记录。
          </p>
          <div className="story-illustration" aria-hidden="true">
            <div className="story-card card-one">
              <span className="round-icon peach">
                <Sparkles />
              </span>
              <div>
                <strong>每一份努力，都值得</strong>
                <small>记录 · 确认 · 一起成长</small>
              </div>
              <Check size={20} />
            </div>
            <div className="story-card card-two">
              <span className="round-icon sage">
                <Heart />
              </span>
              <div>
                <strong>让好习惯，慢慢发芽</strong>
                <small>今天，也比昨天前进了一点</small>
              </div>
              <ArrowUpRight size={22} />
            </div>
            <span className="illustration-circle" />
          </div>
        </div>
        <small className="story-footer">属于一家人的，温暖小空间。</small>
      </section>
      <section className="login-panel">
        <div className="login-box">
          <p className="eyebrow">一家人的成长小空间</p>
          <h2>欢迎回家</h2>
          <p className="muted">登录帐号，看看今天的成长故事。</p>
          <CommandForm className="login-form">
            <input type="hidden" name="action" value="login" />
            <label htmlFor="username">帐号</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="请输入你的帐号"
              required
              maxLength={40}
            />
            <label htmlFor="password">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="请输入密码"
              required
              maxLength={200}
            />
            <Button type="submit">
              登录 <ArrowUpRight size={18} />
            </Button>
          </CommandForm>
          <p className="login-help">仅限家庭成员使用 · 帐号由管理员维护</p>
        </div>
      </section>
    </div>
  );
}
