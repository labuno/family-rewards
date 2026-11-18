import { it, expect } from 'vitest';
import { testDatabase } from '../support/database';
import { backupDatabase } from '../../src/server/backup';
import { createDatabase } from '../../src/server/db';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
it('一致性备份能恢复真实钱包，目标权限受限，不能覆盖已有备份', async () => {
  const f = testDatabase();
  await f.init();
  await f.db.wallet.create({ data: { subjectId: 'saved', money: -1234, points: 15 } });
  const dir = mkdtempSync(join(tmpdir(), 'family-backup-')),
    target = join(dir, 'backup.db');
  try {
    await backupDatabase(f.url, target);
    expect(statSync(target).mode & 0o777).toBe(0o600);
    const restored = createDatabase('file:' + target);
    expect(await restored.wallet.findUnique({ where: { subjectId: 'saved' } })).toMatchObject({
      money: -1234,
      points: 15,
    });
    await restored.$disconnect();
    await expect(backupDatabase(f.url, target)).rejects.toThrow('已存在');
  } finally {
    await f.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
