# dsh-im-hub — 发布记录(已完成 ✅)

## 已发布

| 项目 | 状态 | 链接 |
|---|---|---|
| GitHub 主仓库 | ✅ 已创建并推送 | https://github.com/ThreeBody6666/dsh-im-hub |
| 仓库 topics | ✅ dsh-plugin 等 10 个 | https://github.com/ThreeBody6666/dsh-im-hub |
| awesome-dsh-plugin 收录 | ✅ PR #139 | https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/139 |
| 0xsline/awesome-deepseek-harness 收录 | ✅ PR #107 | https://github.com/0xsline/awesome-deepseek-harness/pull/107 |
| Alex-Yanggg/awesome-DSH-plugin 收录 | ✅ PR #34 | https://github.com/Alex-Yanggg/awesome-DSH-plugin/pull/34 |

## 说明

- 3 个收录 PR 均已附带双语描述(英文 README + 中文 README/CATALOG),符合各列表的贡献规范。
- Alex-Yanggg 列表的 PR 注明了未在本机运行 `generate_readmes.py`(无 Python),zh-CN 镜像可由维护者运行脚本生成。
- 仓库 topics 已含 `dsh-plugin`(awesome-dsh-plugin 收录硬性要求)。
- npm 发布未执行(需 npm 账号);如需 `dsh plugin add dsh-im-hub` 直接可用,再执行:
  ```bash
  npm login && npm publish --access public
  ```

## 安全提醒

- 发布用的 GitHub PAT 已出现在对话中,请尽快在 GitHub → Settings → Developer settings → Personal access tokens 中 **Revoke**(撤销)该 token。已发布的仓库不受影响。
