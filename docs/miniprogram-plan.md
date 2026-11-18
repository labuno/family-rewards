# MP-001 微信小程序实施合同

基线：95d114a；规模 M，两个有依赖的交付单元。

## objective

在 miniprogram 分支新增原生微信小程序，与现有 Web 共用业务服务和数据库。

## scope

第一版覆盖帐号密码登录、管理员切换成员、首次设置、看板、金钱与积分范围历史、类型及新增类型、记录预览和登记、确认与沟通、删除与反向更正、总结生成确认入账、协议文件和退出。仅一个家庭；不做微信绑定、多家庭、支付或自动通知。

## steps

WP01 提供 JSON API 和 Bearer 会话；WP02 消费 API 实现原生小程序页面。先完成接口，再接通客户端。

## interfaces

新增 /api/mini 请求入口：GET resource 查询、POST action 命令，JSON 返回，不重定向。复用 Accounts 数据库会话与 Family 权限、事务和提交标识。网页 Cookie 和来源检查保留。金额以整数分传输，日期按北京时间。附件由 Bearer 鉴权下载。

## work_packages

WP01 产出 artifact:mini-api；WP02 消费该接口并产出 artifact:mini-client，提供可导入微信开发者工具的项目与配置说明。

## test_matrix

先写隔离数据库 API 行为测试和模拟 wx 的客户端行为测试，观察缺失模块 RED。覆盖登录失败与失效、权限、Web/小程序共享数据、资产过滤、登记预览、重复提交、确认更正删除、结算状态及附件。客户端覆盖请求失败、401、保留重试标识、页面加载及提交导航。

## verification

运行 npm test、npm run typecheck、npm run format:check、npm run build 和现有 Web Playwright 回归；增加真实 HTTP 小程序客户端联调。校验所有页面配置与 WXML 引用。无 AppID 时不能声称完成微信工具编译、真机或发布验收。

## done_criteria

交付本地验证代码、接口和导入说明及验收证据。小程序使用游客 AppID 占位，API 默认本地地址，不连接正式服务。公开发布需要用户后续提供 AppID 和配置合法域名；本轮不部署生产、不提交微信审核。

## stop_conditions

保持已有权限、必要去重及原子结算；不改正式数据。需要微信帐号或真机授权时记录外部验收限制，不伪造成功。

## external_sources

Next.js 路由按 node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md。微信结构和请求依据官方文档 https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html 与 https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html；本次网页工具无法加载，使用标准 App/Page/wx.request 接口，平台编译留待开发者工具实测。
