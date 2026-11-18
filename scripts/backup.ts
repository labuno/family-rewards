import { backupDatabase } from '../src/server/backup';
const target = process.argv[2];
if (!target) {
  console.error('用法：npm run backup -- /受限目录/新的备份文件.db');
  process.exitCode = 1;
} else {
  backupDatabase(process.env.DATABASE_URL ?? 'file:./data/family.db', target)
    .then(() => console.log('一致性备份完成，文件权限 600。'))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : '备份失败');
      process.exitCode = 1;
    });
}
