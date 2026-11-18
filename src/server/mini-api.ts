import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Database } from './db';
import { Accounts } from './accounts';
import { miniQuery } from './mini-queries';
import { miniCommand } from './mini-commands';

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function agreement(query: URLSearchParams, directory: string) {
  const format = z.enum(['pdf', 'docx']).parse(query.get('format') ?? 'pdf');
  try {
    const bytes = await readFile(join(directory, 'family-agreement.' + format));
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type':
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="family-agreement.${format}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return json({ error: '协议附件尚未就绪，请联系管理员' }, 404);
    throw error;
  }
}
function failure(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return json({ error: '请检查必填项、时间和次数' }, 400);
  const message = error instanceof Error ? error.message : '操作失败';
  const forbidden = /没有权限|仅管理员/.test(message);
  const internal =
    /Prisma|SQLITE|Unique constraint|Invalid.*invocation|database.*locked|timed out/i.test(message);
  return json(
    { error: internal ? '保存发生冲突或服务暂忙，请刷新后重试' : message },
    forbidden ? 403 : 400,
  );
}
export function createMiniHandler(db: Database, options: { agreementDirectory?: string } = {}) {
  const accounts = new Accounts(db);
  return async (request: Request) => {
    try {
      const input =
        request.method === 'POST'
          ? z.record(z.string(), z.unknown()).parse(await request.json())
          : {};
      if (request.method === 'POST' && input.action === 'login') {
        const data = z
          .object({ username: z.string().min(1).max(40), password: z.string().min(1).max(200) })
          .parse(input);
        return json(await accounts.login(data.username, data.password));
      }
      const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
      const actor = token ? await accounts.resolve(token) : null;
      if (!actor) return json({ error: '请先登录' }, 401);
      if (request.method === 'POST' && input.action === 'logout') {
        await accounts.logout(token!);
        return json({ ok: true });
      }
      if (request.method === 'POST') return json(await miniCommand(db, actor, input));
      const query = new URL(request.url).searchParams;
      if (query.get('resource') === 'agreement')
        return await agreement(
          query,
          options.agreementDirectory ?? join(process.cwd(), 'uploads/agreements'),
        );
      return json(await miniQuery(db, actor, query));
    } catch (error) {
      return failure(error);
    }
  };
}
