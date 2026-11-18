'use client';
import { Button } from '../components/ui/button';
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel error-page">
      <h1>暂时无法打开</h1>
      <p>
        {error.message.includes('没有权限')
          ? '没有权限访问该记录'
          : '请刷新页面或返回首页重试。如重复发生，请联系管理员。'}
      </p>
      <Button onClick={reset}>重试</Button>
      <a href="/">返回首页</a>
    </div>
  );
}
