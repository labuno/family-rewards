import SQLite from 'better-sqlite3';
import { chmodSync, closeSync, mkdirSync, openSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
export async function backupDatabase(sourceUrl: string, target: string) {
  if (!sourceUrl.startsWith('file:')) throw new Error('仅支持本地数据库备份');
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  try {
    closeSync(openSync(target, 'wx', 0o600));
  } catch {
    throw new Error('备份目标已存在或不可写，请使用新文件名');
  }
  const source = new SQLite(sourceUrl.slice(5), { readonly: true, fileMustExist: true });
  try {
    await source.backup(target);
    chmodSync(target, 0o600);
  } catch (e) {
    unlinkSync(target);
    throw e;
  } finally {
    source.close();
  }
}
