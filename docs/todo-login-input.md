# Todo: 登录帐号保留输入大小写

- **Status**: 验证成功
- **Scope**: 关闭移动端帐号框自动大写和自动纠错；不更改帐号及密码匹配规则。
- **Baseline**: main，首次交付代码尚未提交。

## Behavior

输入 dad 或混合大小写时保留原文；帐号框 autocapitalize=none、autocorrect=off、spellcheck=false；密码仍按原值验证。

## Test first

浏览器检查输入属性、混合大小写保留、正常登录和错误密码。预期 RED：登录帐号框缺少 autocapitalize=none。

## Implementation

仅调整 src/app/login/page.tsx，映射 tests/browser/app.spec.ts，不改数据库。

## Verification

浏览器全套、类型、格式及生产构建；正式 HTTPS 检查输入属性。

## Done

- [x] 观察 RED，完成 GREEN 和回归。
- [x] Docker 更新并验证公网。

## Evidence

- RED：浏览器测试实际失败：帐号框缺少 autocapitalize=none。
- GREEN：浏览器 5 条通过，含输入原文与属性、正常及错误登录；类型和格式通过。
- 部署：正式数据已备份，ARM64 Docker 生产构建成功；仅重建应用，健康检查通过，Nginx 校验并平滑重载。公网可信 HTTPS 登录、帐号输入属性、创建人按钮隐藏，以及对正式已有记录重复确认无副作用均已验证。
