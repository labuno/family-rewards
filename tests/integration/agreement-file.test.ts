import { beforeEach, expect, it, vi } from 'vitest';
const { user, read } = vi.hoisted(() => ({ user: vi.fn(), read: vi.fn() }));
vi.mock('../../src/server/session', () => ({ currentUser: user }));
vi.mock('node:fs/promises', () => ({ readFile: read }));
import { GET } from '../../src/app/api/agreement-file/route';
const request = (query = '') => new Request('https://family.example/api/agreement-file' + query);
beforeEach(() => {
  vi.resetAllMocks();
  user.mockResolvedValue({ id: 'child', role: 'USER' });
});
it('未登录不能获取文件，不进行文件读取', async () => {
  user.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(401);
  expect(read).not.toHaveBeenCalled();
});
it('拒绝未知格式及任意文件路径', async () => {
  expect((await GET(request('?format=../../.env'))).status).toBe(400);
  expect(read).not.toHaveBeenCalled();
});
it('登录用户可在线查看PDF，响应不公开缓存', async () => {
  read.mockResolvedValue(Buffer.from('%PDF-1.7\ntest'));
  const response = await GET(request('?format=pdf'));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/pdf');
  expect(response.headers.get('content-disposition')).toMatch(/^inline;/);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(Buffer.from(await response.arrayBuffer()).toString()).toContain('%PDF-');
  expect(read.mock.calls[0][0]).toMatch(/uploads\/agreements\/family-agreement\.pdf$/);
});
it('原始Word作为附件下载，文件名与字节保留', async () => {
  const bytes = Buffer.from('PK-test-word');
  read.mockResolvedValue(bytes);
  const response = await GET(request('?format=docx'));
  expect(response.headers.get('content-type')).toContain('wordprocessingml.document');
  expect(response.headers.get('content-disposition')).toContain('attachment;');
  expect(response.headers.get('content-disposition')).toContain(
    encodeURIComponent('家庭奖惩协议.docx'),
  );
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
});
it('缺少协议文件明确404，其他读取错误不静默掩盖', async () => {
  read.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  expect((await GET(request('?format=pdf'))).status).toBe(404);
  read.mockRejectedValue(new Error('read failure'));
  await expect(GET(request('?format=pdf'))).rejects.toThrow('read failure');
});
