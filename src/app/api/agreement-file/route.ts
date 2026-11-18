import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { currentUser } from '../../../server/session';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!(await currentUser())) return Response.json({ error: '请先登录' }, { status: 401 });
  const format = new URL(request.url).searchParams.get('format') ?? 'pdf';
  if (format !== 'pdf' && format !== 'docx')
    return Response.json({ error: '不支持的附件格式' }, { status: 400 });
  try {
    const bytes = await readFile(
      join(process.cwd(), 'uploads/agreements', `family-agreement.${format}`),
    );
    const type =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const disposition = format === 'pdf' ? 'inline' : 'attachment';
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': type,
        'Content-Disposition': `${disposition}; filename="family-agreement.${format}"; filename*=UTF-8''${encodeURIComponent('家庭奖惩协议.' + format)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return Response.json({ error: '协议附件尚未就绪，请联系管理员' }, { status: 404 });
    throw error;
  }
}
