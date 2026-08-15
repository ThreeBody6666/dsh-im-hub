# dsh-im-hub — 发布记录

## 已发布

| 项目 | 状态 | 链接 |
|---|---|---|
| GitHub 主仓库 | ✅ 已创建并推送 | https://github.com/ThreeBody6666/dsh-im-hub |
| 仓库 topics | ✅ dsh-plugin 等 10 个 | https://github.com/ThreeBody6666/dsh-im-hub |
| npm 发布 | ✅ `dsh-im-hub@0.2.0` | https://www.npmjs.com/package/dsh-im-hub |

## 社区收录 PR（2026-08-15 重新提交）

> 第一轮 PR(#139/#107/#34)因**删除 fork 仓库被自动关闭**(未合并,非维护者拒绝)。重新 fork 后已重新提交,本次保留 fork 直到合并。

| 列表 | PR | 状态 |
|---|---|---|
| awesome-dsh-plugin | [#321](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/321) | ⏳ 待合并 |
| 0xsline/awesome-deepseek-harness | [#147](https://github.com/0xsline/awesome-deepseek-harness/pull/147) | ⏳ 待合并 |
| Alex-Yanggg/awesome-DSH-plugin | [#43](https://github.com/Alex-Yanggg/awesome-DSH-plugin/pull/43) | ⏳ 待合并 |

## 版本历史

- `0.2.0` — **GUI 可视化设置卡片**:host 端显式注入 `settings` 服务注册 `im-hub` namespace + 保存即热重载;client 端 `web-ui.plugin.item` 插槽卡片(8 组字段、双语、secret 只写);README 引导式配置截图;npm 发布。
- `0.1.0` — 多平台 IM 网关初版(飞书/Lark 长连接、企微加密回调、Telegram 长轮询、mock),npm 发布。

## 说明

- `dsh plugin --profile <name> add dsh-im-hub` 安装的是最新 0.2.0。
- Alex-Yanggg 列表的 PR 注明了未在本机运行 `generate_readmes.py`(无 Python),zh-CN 镜像可由维护者运行脚本生成。

## 安全提醒

- GitHub PAT 与 npm token 已在对话中出现,发布完成后请尽快在对应平台 Revoke。
