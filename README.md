# 家庭成长站 Family Rewards

供家庭长期使用的响应式网站，手机和电脑共用同一套帐号、记录及钱包。代码位于本项目，独立 Docker Compose 部署至 Oracle ARM64。

网站地址：**https://ellie-rewards.duckdns.org**。公网可访问状态见[交付记录](docs/delivery-report.md)。

## 已实现

- 爸爸、妈妈两个管理员帐号和 Ellie 普通帐号；管理员看全部，普通用户只看自己的完整记录。
- 管理员新增记录类型，定义每次金钱、积分；日常记录选择类型，登记次数、时间、原因与确认。
- 首次由管理员选择协议月起点；月底查询哭泣记录、生成总结、本人及任一管理员确认（创建即确认），再统一更新两个钱包。
- 奖励和扣减分别月度封顶，金钱钱包允许负数；类型、事实、结算和钱包流水可追溯。
- 反向记录纠错，明确显示原事项；已结算差额单列调整。
- 创建人可在任何其他成员确认前删除记录，保留删除审计；确认后关闭沟通入口，旧沟通留在时间线。
- 试卷跳过为 -10 积分事项，每自然月一次，只使用足够的已结算积分。
- 手机看板、金钱／积分菜单、历史筛选、操作时间线和手动一致性备份。
- 手机底部及电脑侧栏直接进入记录类型，统一查看预设和自定义规则；我们的约定提供协议 PDF 预览及原始 Word 下载。

钱包从 0 开始，没有单独的余额初始化页面。商品商城、图片、跨系统兑换、在线规则发布和自动任务未实现。

界面采用暖白与珊瑚橙配色，首页集中呈现已结算余额、未入账预计、待确认事项和事实记录；手机使用底部导航，电脑使用侧栏。预览：[手机](docs/previews/mobile.png)、[电脑](docs/previews/desktop.png)。预览使用隔离演示数据。

## 技术

Node 24.16.0、TypeScript、Next.js 16.4.2、React 19.3.1、Tailwind CSS、shadcn/ui 风格基础组件、Prisma 7.10.1、SQLite。依赖版本由 package-lock.json 固定，Docker 基础镜像固定摘要。

```sh
nvm use
npm ci
npm test
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

本地启动、帐号数据库维护、Docker、证书及备份操作见[运行手册](docs/runbook.md)。本地和正式环境各自使用独立受限配置，不提交真实帐号密码、Token、数据库或备份。

## 文档

- [产品设计](docs/product-design.md)
- [开发设计](docs/development-design.md)
- [需求决策及记录模型澄清](docs/open-questions.md)
- [运行手册](docs/runbook.md)
- [交付记录](docs/delivery-report.md)
- [实现与验证映射](docs/source-test-map.md)
- [开发执行图](docs/todos/FR-001/execution-map.json)

正式初始密码只保存在服务器 `/opt/family-rewards/secrets/credentials.txt`，通过可信 SSH 终端使用 sudo 读取，不复制到公开聊天中。
