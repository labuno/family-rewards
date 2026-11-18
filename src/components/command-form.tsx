'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
export function CommandForm({
  children,
  className = '',
  onSuccess,
}: {
  children: ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/commands', {
        method: 'POST',
        body: new FormData(e.currentTarget),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '操作失败');
      if (data.redirect) router.push(data.redirect);
      router.refresh();
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className={className} aria-busy={busy}>
      <fieldset disabled={busy}>{children}</fieldset>
      {busy && <p className="form-hint">正在保存，请稍候…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </form>
  );
}
