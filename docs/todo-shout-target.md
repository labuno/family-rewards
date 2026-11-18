# Todo: 大吼大叫事项选择对象

- **Status**: 验证成功
- **Scope**: 仅“对长辈大吼大叫”选择对象，保存证据并在详情展示；验证后更新现有 oracle-sg 服务。
- **Baseline**: 2026-11-02 当前线上镜像 `5a6aabded62f`；用户追加“其他”，最终选项为爷爷、奶奶、爸爸、妈妈、姑姑、其他。

## Behavior

- 仅SHOUT显示“对象”选择框，共六项，默认提示选择且必填，不替用户预选对象；其余事项不显示。
- API在表单边界验证六个选项，将选择存入 evidence.shoutTarget；其他类型不保存该字段。详情展示所选对象。
- 原SHOUT记录无对象仍可读取，不补写旧事实；单次扣100元、次数和月封顶规则不变。“其他”是独立选项，本轮不增加说明输入框。

## Test first

浏览器验证条件显示、六个选项、空值必选、非法对象400、爷爷与其他保存后刷新仍展示、非SHOUT忽略对象、手机布局与预计扣减不变。预期RED：SHOUT表单没有对象字段。

## Implementation / Verification

rules.ts仅定义共享选项；EventForm条件渲染；commands在已有证据边界验证并保存；详情读取证据。tests/browser/app.spec.ts映射全部变更，既有domain/集成测试验证旧证据兼容和金额计算。运行聚焦浏览器、单元/集成、类型/格式及服务器ARM64生产构建。无迁移。部署只同步应用文件，保留服务器Nginx/Compose/环境，备份和替换旧应用后做只读公网验收，不创建正式测试记录。

## Done

- [x] 预期RED与实现验证完成。
- [x] 部署及原数据、配置保持验证完成。

## Evidence

- RED：SHOUT找不到“对象”选择框，浏览器预期失败。
- GREEN：六项及必选、爷爷/其他保存并刷新展示、非法对象400、其他类型忽略对象、单次扣100元及手机布局均通过。公网从金钱钱包新建SHOUT可选“其他”，六项顺序及必选状态已验证，未提交正式事项。

- 回归：89项单元/集成、15条完整Chrome流程、类型和格式检查通过；Oracle ARM64默认Turbopack生产构建成功。
- 已发布镜像 `sha256:ecefcfc0aeb2b47efb97902ae276ce9611b561641c8542d51db65c7d9f00f787`，新容器 `4dce90d81b24` 健康，旧容器 `0f4bc49b5965` 已移除。
- 公网三个原帐号各读取8个页面并验证两个协议附件；业务表、环境、凭据、Nginx、Compose及附件指纹保持，其他10个容器ID/状态不变。验收未创建正式业务数据。
- 数据备份 `/opt/family-rewards/data/backups/before-wallet-shout-20261102-1650.db`；构建、前后指纹、配置备份和发布结果位于 `/opt/family-rewards/backups/wallet-shout-20261102-1650/`。原版本镜像仅以 `family-rewards:before-wallet-shout-20261102-1650` 保留作回退，临时包已清理。
