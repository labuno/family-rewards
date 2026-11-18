# Todo: 协议附件在线查看与原件下载

- **Status**: 验证成功
- **Scope**: 在“我们的约定”中查看实际协议 PDF 预览，下载原始 Word。
- **Baseline**: 当前确认修订已上线，类型目录修订正在验收。

## Behavior

原件使用用户提供的 ~/Downloads/家庭奖惩协议.docx，原始字节不修改；本机离线转换为 PDF 供手机／电脑预览，并明确预览排版可能与 Word 略有差异。登录家庭成员可查看和下载，未登录不能获取文件；固定两种文件格式，不接受任意文件路径。缺失文件明确提示。文件独立持久化并只读挂载，保留下载文件名、正确 MIME 与私有缓存控制。不实现上传、版本管理、在线编辑或第三方在线预览。

## Test first

- tests/integration/agreement-file.test.ts：先验证未登录401且不读盘、格式非法400、PDF在线响应、Word下载响应、文件缺失404、其他读取错误传播。
- tests/integration/deploy.test.ts：要求附件目录只读挂载。
- tests/browser/app.spec.ts：管理员和普通用户可见附件入口、PDF魔数、下载Word字节与原始文件相同、匿名不可下载、预览可打开。
- 预期 RED：附件接口不存在、页面无附件区、Compose无只读挂载。

## Implementation

src/app/api/agreement-file/route.ts 认证后读取固定文件；agreement/page.tsx 增加附件区；uploads/agreements 私有目录保存原件和离线 PDF，不放 public、不进 Git或镜像。Compose只读挂载。通过本机 textutil 和 Chrome 离线生成 PDF，不安装服务器转换服务。

## Verification

单元／集成、浏览器、类型／格式、ARM64构建；正式文件SHA256与本地原件一致，匿名401、登录查看下载通过。类型目录修订一并部署，更新前已备份，不改业务数据。

## Done

- [x] RED → GREEN 与相关回归通过。
- [x] 持久化附件、文档及部署完成，公网实测通过。

## Evidence

- RED：接口缺失404而预期401、附件模块不存在、只读挂载断言失败。
- GREEN：67项单元／集成、6条真实Chrome流程通过；类型／格式及Oracle ARM64生产构建通过。
- 部署：更新前数据库一致性备份与旧镜像已保留，只重建家庭应用，健康检查及Nginx校验／平滑重载通过。
- 公网：物理网卡直连可信HTTPS，爸爸与Ellie均实际查看八种预设、按角色维护类型、查看协议并下载。匿名附件401；Word与用户原件字节一致，PDF与离线预览一致。未添加正式测试类型、事件、钱包或结算数据。
