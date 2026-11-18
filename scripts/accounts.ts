import { readFileSync, statSync } from 'node:fs';
import { z } from 'zod';
import { Accounts } from '../src/server/accounts';
import { database } from '../src/server/db';
async function main() {
  const file = process.argv[2];
  if (!file)
    throw new Error(
      '用法：npm run accounts -- /受保护路径/accounts.json；包含 username,name,role,password,默认钱包从零开始',
    );
  if ((statSync(file).mode & 0o077) !== 0) throw new Error('帐号文件权限必须为 600');
  const schema = z
    .array(
      z.object({
        username: z.string(),
        name: z.string(),
        role: z.enum(['ADMIN', 'USER']),
        password: z.string().min(12),
        money: z.number().int().default(0),
        points: z.number().int().min(0).default(0),
      }),
    )
    .min(1);
  const rows = schema.parse(JSON.parse(readFileSync(file, 'utf8')));
  const db = database();
  try {
    for (const row of rows)
      await new Accounts(db).create(
        row.username,
        row.name,
        row.role,
        row.password,
        row.money,
        row.points,
      );
    console.log(`已创建 ${rows.length} 个帐号。未输出密码。`);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    e instanceof z.ZodError
      ? '帐号文件字段无效'
      : e instanceof Error && /权限|用法/.test(e.message)
        ? e.message
        : '帐号创建失败；检查用户名是否重复及文件内容，不要公开凭据。',
  );
  process.exitCode = 1;
});
