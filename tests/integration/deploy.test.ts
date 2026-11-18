import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
it('网站入口仅代理家庭应用，拒绝未知域名，不依赖代理容器网络', () => {
  const nginx = readFileSync('deploy/nginx.conf', 'utf8');
  expect(nginx).toContain('server_name ellie-rewards.duckdns.org');
  expect(nginx).toContain('proxy_pass http://app:3000');
  expect(nginx).toContain('ssl_reject_handshake on');
  expect(nginx).toContain('return 444');
  expect(nginx).not.toContain('oracle-proxy');
  const compose = readFileSync('deploy/web.compose.yaml', 'utf8');
  expect(compose).toContain('443:8444');
  expect(compose).toContain('80:8080');
  expect(compose).not.toContain('privileged');
});
it('证书任务只手动运行，凭据与数据库不进入构建上下文', () => {
  const script = readFileSync('deploy/certificate.sh', 'utf8');
  expect(script).toContain('duckdns-token');
  expect(script).toContain('@sha256:');
  expect(script).not.toContain('docker.sock');
  expect(spawnSync('sh', ['deploy/certificate.sh', 'invalid'], { encoding: 'utf8' }).status).toBe(
    1,
  );
  const ignore = readFileSync('.dockerignore', 'utf8').split('\n');
  for (const file of ['secrets', 'acme', 'tls', 'data', '.env*']) expect(ignore).toContain(file);
});
it('只读 Nginx 把所有临时目录放入可写 tmpfs', () => {
  const nginx = readFileSync('deploy/nginx.conf', 'utf8');
  for (const kind of ['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'])
    expect(nginx).toMatch(new RegExp(kind + '_temp_path /tmp/'));
});
it('协议附件独立持久化，只读挂载给应用', () => {
  expect(readFileSync('deploy/compose.yaml', 'utf8')).toContain('../uploads:/app/uploads:ro');
});
