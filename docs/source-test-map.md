# 实现与验证映射

行为测试先于对应实现，初始缺失模块、定额类型计算、新增类型页面、历史筛选和只读 Nginx 临时目录均实际观察过 RED。随后执行聚焦测试和回归。运行状态与最终数量见交付记录。

| 实现文件或范围 | 验证依据 |
|---|---|
| `src/domain/periods.ts`、`rules.ts` | `tests/unit/domain.test.ts`：日历、分档、次数、独立封顶、哭泣候选、定额类型与反向抵销 |
| `src/domain/confirmation.ts` | `tests/unit/confirmation.test.ts`：创建即确认、双方缺一不可、管理员任选、异议覆盖及解除 |
| `src/domain/money.ts` | `tests/unit/money.test.ts`：整数分解析、负数、非法输入 |
| `src/domain/event-impact.ts`、`src/components/impact.tsx` | `tests/unit/event-impact.test.ts`：单笔金额/积分/零变化/自定义双资产/反向抵销；`tests/browser/app.spec.ts`：实时预览、列表带符号及增减文字 |
| `src/domain/assets.ts`、钱包/表单/历史/成员选择与列表的资产范围 | `tests/unit/assets.test.ts`：预设类型、0元考试、自定义单/双资产、反向继承、范围参数；`tests/browser/app.spec.ts`：两钱包互不混入、双资产按页投影、记一笔及历史保留范围、筛选与成员切换 |
| `rules.ts` 的对象选项、`event-form.tsx`、commands及记录详情 | `tests/browser/app.spec.ts`：SHOUT六个对象、条件显示/必选/非法值400、爷爷和其他持久化刷新、非SHOUT忽略对象、扣减预览与手机布局；原domain/集成测试验证旧SHOUT证据继续有效 |
| `src/services/summary.ts` 的 `previewPeriod`、`src/server/view.ts`、首页与钱包预计值 | `tests/integration/preview.test.ts`：线上四笔事实复现、整月奖励分离、积分、待确认/异议、跨期、哭泣及抵销/删除；浏览器验证一致口径、奖励状态与日期原因链接 |
| `src/components/event-form.tsx`、新增记录页、`src/app/api/commands`、记录详情、选择框 CSS | `tests/browser/app.spec.ts`：考试年级条件显示和保存、同年级多场考试、分数0与空分数、等级/次数/自定义类型预览、选择框尺寸和 appearance、四种视口截图；`tests/unit/money.test.ts`：客户端与服务端共用金额格式 |
| `src/server/accounts.ts`、`permissions.ts` | `tests/integration/auth.test.ts`：哈希、会话、角色、首次设置、重复帐号和错误 |
| `src/server/db.ts`、Prisma 模型与迁移 | 所有真实文件 SQLite 集成测试、两个独立连接并发、正式容器迁移 |
| `src/server/record-types.ts` | `tests/integration/record-types.test.ts`：权限、重复名称、非法值、次数结算及规则快照 |
| `src/services/family.ts`、`state.ts`、`summary.ts` | `tests/integration/deletion.test.ts`：创建人权限、他人曾确认、删除幂等与事务回滚、确认并发、旧数据库迁移及有效反向次数； `tests/integration/ledger.test.ts` 、`tests/integration/confirmation.test.ts` 与类型测试：创建即确认、任一管理员、旧快照兼容、确认、异议、限次、负数、反向更正、旧期调整、重复、真实并发与故障回滚 |
| `src/server/backup.ts` | `tests/integration/backup.test.ts` 与正式手动备份恢复读取：文件权限、余额恢复、目标不可覆盖 |
| `src/server/session.ts`、`view.ts`、`src/app/api/commands` | `tests/browser/app.spec.ts`：登录注销、来源校验、权限、事件表单、结算确认及钱包；正式 HTTPS 帐号冒烟 |
| 所有 `src/app` 页面、布局与 CSS、`src/components` | `tests/browser/app.spec.ts`：手机／电脑完整业务流程、首页信息顺序、320/390/768/1440px 八个主要页面、规则列表、普通用户权限、负余额、长文案、错误保留输入、底栏不遮挡；实际截图检查与生产 Next.js 构建、类型检查 |
| `src/app/api/agreement-file`、协议附件 | `tests/integration/agreement-file.test.ts`、浏览器实际PDF及Word下载、原件字节核对、匿名401、只读挂载检查 |
| `src/app/api/health` | 正式容器健康检查、实际端口 HTTP／HTTPS 检查 |
| `scripts/accounts.ts` | 浏览器隔离数据库初始化及正式三个零余额帐号创建；无密码输出 |
| `scripts/backup.ts` | 正式容器手动一致性备份与独立读取验证 |
| `deploy/nginx.conf`、Compose、证书脚本、Dockerfile | `tests/integration/deploy.test.ts`、shell 语法、ARM64 实际构建、Nginx 配置校验、TLS 主机名检查、Docker inspect 和端口检查 |
| Next、TypeScript、PostCSS、测试和格式配置 | 类型检查、格式检查、生产构建、单元／集成／浏览器实际执行 |
| 产品、开发、决策、运维文档 | 本地链接、表格、决策与实现范围一致性检查；执行图与固定摘要检查 |

测试使用假密码与隔离数据库；真实密码、Token、数据及浏览器会话不进入仓库或公开测试日志。

## 微信小程序（MP-001）

- `src/server/mini-api.ts`、`mini-commands.ts`、`mini-queries.ts`：`tests/integration/mini-api.test.ts` 使用隔离 SQLite 验证 Bearer 会话、角色权限、资产过滤、规则预览、登记重试、确认、删除、更正、总结与失效、重复入账及附件错误。
- `src/app/api/mini/route.ts`：`tests/browser/mini.spec.ts` 通过真实 Next.js HTTP 路由连接实际小程序页面 JS，同时验证 Web 查询、确认及钱包同步。
- `miniprogram/utils/api.js`、`page.js`、`view.js` 和 `pages/*/index.js`：`tests/unit/mini-client.test.ts`、`mini-pages.test.ts` 验证 wx 请求边界、401、文件打开、失败重试标识、异步互斥、登录、成员切换、筛选、录入边界和页面事件绑定。
- `miniprogram/app.json`、页面 JSON/WXML：页面完整性和事件处理器校验在 `mini-pages.test.ts`；格式命令覆盖 JS、JSON、WXSS、WXML。WXML/WXSS 原生编译与视觉效果需要微信开发者工具及真机，本地 Node/浏览器验证不能替代。
- `tests/support/mini-runtime.ts` 在独立 VM 中加载实际 CommonJS 页面与工具模块，模拟 `Page`、`getApp`、`setData` 和 wx Adapter；不模拟业务服务。
