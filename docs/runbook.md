# 家庭成长站运行与维护

代码位于 `~/Documents/products/github/family-rewards`，服务器项目位于 `/opt/family-rewards`。网站地址为 `https://ellie-rewards.duckdns.org`，公网访问状态以[交付记录](delivery-report.md)为准。

## 首次使用

通过 SSH 登录服务器，在自己的可信终端读取三个帐号的随机密码：

```sh
sudo cat /opt/family-rewards/secrets/credentials.txt
```

不要公开该输出。爸爸、妈妈为管理员，Ellie 为普通用户，登录名分别为 dad、mom、ellie。正式钱包均从 0 开始，无测试业务记录；第一次由管理员选择协议月起点。

从手机底部或电脑侧栏的“记录类型”直接查看所有预设与自定义类型，并定义额外事项及每次对应金钱、积分，再通过“记一笔”登记次数、发生时间与原因。预设考试、家务等类型也可以直接使用。记录与确认不直接改钱包，创建即确认：管理员创建后只等本人，本人创建后只等任一管理员，另一管理员无需确认。事件、反向更正和总结统一采用此规则。完整协议月结束后生成总结，双方确认后由任意管理员入账。帐号框关闭自动大写和自动纠错，保留输入大小写；妈妈帐号仍是 mom。

跳过课外试卷使用 10 个已结算积分，每自然月一次；未结算获得积分不可使用。错误通过反向记录更正，不删除原记录。

## 本地开发

使用 `.nvmrc` 指定的 Node 24.16.0，不能直接沿用机器上的 Node 23 运行已编译的 SQLite 驱动。

```sh
nvm use
npm ci
```

从 `.env.example` 创建权限为 600 的 `.env`，设置独立随机 SESSION_PASSWORD（至少 32 字符），本地 APP_ORIGIN 为 `http://127.0.0.1:3000`，COOKIE_SECURE 为 false。正式环境必须为 HTTPS 和 true；文件不能入 Git。

```sh
npm run db:migrate
npm run accounts -- /受限目录/accounts.json
npm run dev
```

帐号输入文件权限必须为 600，每项包含 username、name、role、password。密码至少 12 位；正式初始化不填写 money／points，默认均为 0。此脚本是数据库维护工具，没有公开用户创建页面。浏览器测试使用单独的 `data/browser.db` 和假密码，不使用正式数据。

```sh
npm test
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

Playwright 当前使用本机 Google Chrome；测试机器需安装 Chrome，或为 Playwright 安装并配置 Chromium。端到端五个流程按顺序共享测试账本，完整运行该测试文件。

## 查看与管理容器

在服务器上执行：

```sh
sudo docker compose -f /opt/family-rewards/deploy/compose.yaml -f /opt/family-rewards/deploy/web.compose.yaml ps
sudo docker compose -f /opt/family-rewards/deploy/compose.yaml -f /opt/family-rewards/deploy/web.compose.yaml logs --tail 60 app web
sudo docker stats --no-stream family-rewards-app-1 family-rewards-web-1
```

启动、停止、重启仅针对本项目：

```sh
sudo docker compose -f /opt/family-rewards/deploy/compose.yaml -f /opt/family-rewards/deploy/web.compose.yaml up -d --no-build --wait
sudo docker compose -f /opt/family-rewards/deploy/compose.yaml -f /opt/family-rewards/deploy/web.compose.yaml stop
sudo docker compose -f /opt/family-rewards/deploy/compose.yaml -f /opt/family-rewards/deploy/web.compose.yaml restart
```

停止保留数据库、证书、帐号与配置，不操作 `/opt/proxy`。需要移除容器时使用本项目的 `down`，不执行全局 Docker prune，也不删除业务数据。

## 配置与网络

| 位置 | 用途 |
|---|---|
| `/opt/family-rewards/.env` | 域名来源、会话密钥、数据库位置；root 600 |
| `/opt/family-rewards/data/family.db` | SQLite 正式数据库 |
| `/opt/family-rewards/secrets/credentials.txt` | 初始随机密码；root 600 |
| `/opt/family-rewards/secrets/duckdns-token` | 本项目独立的 DuckDNS 凭据副本；root 600 |
| `/opt/family-rewards/acme` | ACME 账户与状态；root 受限目录 |
| `/opt/family-rewards/tls` | Nginx 证书副本，私钥 root:101 640 |
| `deploy/nginx.conf` | 家庭网站域名分流，未匹配域名拒绝 |

网站只对外发布 TCP 80／443；应用 3000 仅绑定宿主 127.0.0.1，SQLite 不开放网络端口。Nginx 与应用在独立 Docker 网络，不加入代理网络。现有 Reality 8443／9443、Hysteria2 UDP 2443 和订阅服务不改动。

OCI 安全列表若尚未开放网站端口，需要两条 Stateful 入站规则：来源 0.0.0.0/0，TCP，来源端口 All，目的端口分别 80、443。已有 SSH 与代理规则保持不变。

## 手动证书续期

证书由官方 acme.sh 容器通过 DuckDNS DNS-01 和 Let's Encrypt 签发，原始账户和 DNS Token 不挂给应用或 Nginx。SSL 必须验证域名与可信证书，不跳过验证。

本期没有安装自动业务任务或证书续期定时器；续期需由运维手动执行，不应误认为已经无人值守。当前证书到期日见交付记录，应在到期前执行：

```sh
sudo sh /opt/family-rewards/deploy/certificate.sh renew
```

脚本只在到期窗口续期，复制证书、校验 Nginx 并平滑重载，不重启应用或代理。`--cron` 在脚本中只是一次检查，不会创建后台定时任务。执行输出不应开启 debug，避免 DNS Token 出现在调试 URL 日志中。

## 一致性备份与恢复

手动备份采用 SQLite 在线备份能力，创建新的文件名：

```sh
sudo docker compose -f /opt/family-rewards/deploy/compose.yaml exec -T app npm run backup -- /data/backups/新的备份文件.db
```

备份文件权限为 600。不要直接复制正在写入的数据库当作一致性备份。更新前除数据库外，还应离线保存配置、密钥、ACME 状态和证书到受限目录；包含明文凭据的备份不能提交 Git。

数据库恢复属于灾难恢复，不能用于日常改账。先停止本项目并保留当前数据库副本，再从经过验证的一致性备份恢复 `/opt/family-rewards/data/family.db`，保留 UID 1000 的读写权限，使用与该数据库迁移版本匹配的应用镜像启动。恢复后核对帐号、记录数量、钱包余额与流水合计。新版本不可逆迁移不能只回退镜像。

首次部署备份位于 `/opt/family-rewards/data/backups/first-deployment.db`，已验证其中有三个零余额帐号。没有设置自动备份任务，应在实际使用和每次更新前手动备份。

## 更新与域名变更

本项目使用本地构建镜像，不自动跟随 latest。更新先完成本地测试与构建，保存正式备份，再同步排除 `.env`、secrets、data、acme、tls 的代码，构建新版本镜像，最后只重建家庭服务。数据库迁移随应用启动执行，必须先核对迁移影响。应用容器重建后应校验并平滑重载网站 Nginx，使其重新解析应用容器地址：

同步前逐项比较 `deploy` 配置与服务器版本。没有明确要求修改部署配置时，仅更新应用源码，保留服务器上的 Nginx、Compose 和环境配置；服务器可能有本地仓库中没有的定制。2026-11-02 发布曾覆盖 Nginx 差异配置，已从备份恢复，宿主与容器内配置指纹均核对一致。

```sh
sudo docker compose -f /opt/family-rewards/deploy/compose.yaml -f /opt/family-rewards/deploy/web.compose.yaml exec -T web nginx -t -c /etc/nginx/nginx.conf
sudo docker compose -f /opt/family-rewards/deploy/compose.yaml -f /opt/family-rewards/deploy/web.compose.yaml exec -T web nginx -s reload -c /etc/nginx/nginx.conf
```

换域名时更新 DNS、证书、Nginx server_name／重定向、APP_ORIGIN 与证书脚本中的域名，然后校验和部署。帐号、类型、记录、钱包不绑定域名，不需要迁移业务数据；浏览器需要重新登录。

## 发布后的文件清理

每次发布并完成线上验收后，删除本次上传到 `/tmp` 的发布包和临时验收脚本。家庭应用只保留当前运行镜像和最近一个兼容的回退镜像；确认没有容器引用后再删除更早的家庭应用镜像标签。体积很小的正式数据库、协议和受限配置备份继续保留。

没有正在进行的镜像构建时，可以使用 `sudo docker builder prune -af` 清理可重新生成的构建缓存，使用 `sudo docker image prune -f` 清理悬空镜像。清理构建缓存会使下次构建重新下载或编译部分依赖，不影响运行服务。不要执行带 `--volumes` 的全局清理，不按“未使用”直接删除其他项目的带名镜像，不删除 `/var/lib/docker` 或 `/var/lib/containerd` 内部目录。

2026-10-26 已清理本轮发布临时目录、Docker 构建缓存、悬空镜像、家庭站四个旧标签及 APT 下载缓存。当前镜像 `family-rewards:0.1.0`，最近回退镜像 `family-rewards:before-ui-20261026`。本次只做手动清理，没有增加定时任务。

## 协议附件

“我们的约定 → 协议附件”可在线查看 PDF、展开页内预览，或下载原始 Word。文件只允许登录成员访问，不经过第三方预览服务。

服务器原件 `/opt/family-rewards/uploads/agreements/family-agreement.docx`，预览 `/opt/family-rewards/uploads/agreements/family-agreement.pdf`，目录 UID1000/700，文件 UID1000/600；Compose 只读挂载 `/app/uploads`。附件不进 Git、镜像或 public；备份和恢复应包含整个 uploads 目录。原件 SHA256 已与用户提供文件核对相同。PDF 由本机 textutil 转换 HTML 后通过 Chrome 离线打印生成，保留全部文字和7个表格，排版可能与Word不同，下载原件不转换。

本地开发与浏览器附件测试同样需要 `uploads/agreements` 中的这两个受保护文件；从自己的安全备份恢复，不能把测试所需附件上传到公开仓库。更换协议时人工替换原件及对应预览，并检查内容；当前不做在线上传及版本管理。

## 删除与沟通规则更新

记录由创建人提交即确认；其他任何成员确认前，创建人可删除普通或反向记录，其他管理员也不能代删。存在有效反向记录时先处理它；其他成员确认过后永久关闭删除。已确认／已抵销记录不再新增沟通，旧原因和时间仍在确认时间线。

删除以 Event.deletedAt／deletedBy 标记，并写入 EVENT_DELETED 审计；从正常列表、待办和结算排除，底层原始数据与流水保留。不要用数据库物理删除代替产品删除。迁移 `202610200003_event_deletion` 仅添加两列；旧镜像回退会忽略删除标记，因此开始实际删除后，不能直接回退到不支持删除的版本，应使用修复后的兼容版本。

## 2026-11-02 记录预览发布（已替换）

当时运行 `family-rewards:0.1.0`，镜像 `sha256:5a6aabded62fb2d7602ef6f19d94362980323277d220e80d024bb1d7f989a435`（ARM64），最近回退镜像 `family-rewards:before-preview-20261102-1631`。原应用容器已停止并移除，现应用和网站容器均健康。仅保留当前和最近回退两个家庭应用镜像，本次临时上传目录已删除。

数据库备份 `/opt/family-rewards/data/backups/before-preview-20261102-1631.db`；源码、配置备份与发布前后指纹、构建及验收记录位于 `/opt/family-rewards/backups/preview-20261102-1631/`，受限文件权限600。发布没有新数据库迁移，三个原帐号及业务数据保留，未创建正式验收业务记录。完整结果见[本次发布 Todo](todo-deploy-preview-20261102.md)。

## 当前发布：对象选择与钱包事项范围

2026-11-02 最新镜像 `family-rewards:0.1.0`，摘要 `sha256:ecefcfc0aeb2b47efb97902ae276ce9611b561641c8542d51db65c7d9f00f787`（ARM64），应用容器 `4dce90d81b24` 健康。最近回退镜像 `family-rewards:before-wallet-shout-20261102-1650`；原应用容器已移除，两个家庭应用镜像之外的旧标签及本次临时包已清理。

备份 `/opt/family-rewards/data/backups/before-wallet-shout-20261102-1650.db`，配置、源码及验证证据在 `/opt/family-rewards/backups/wallet-shout-20261102-1650/`。无数据库迁移，原数据保留；本次应用同步明确排除整个deploy目录，服务器Nginx/Compose/环境保持。功能及验收见[对象选择](todo-shout-target.md)和[钱包范围](todo-wallet-asset-scope.md)。
