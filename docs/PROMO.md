# dsh-im-hub 宣传文案包

## 📣 中文文案

### 一句话版(微信群 / 朋友圈 / 即刻)

我把 DeepSeek Harness 接进了飞书/企微/Telegram,现在可以在聊天软件里直接指挥 AI 智能体干活了 🚀 开源插件 dsh-im-hub 已发布:
https://github.com/ThreeBody6666/dsh-im-hub

### 标准版(掘金 / 知乎 / V2EX / 简书)

【开源】dsh-im-hub —— 把 DeepSeek Harness 智能体接入飞书、企业微信、Telegram

平时在终端里和 AI 智能体对话,离开电脑就断了。于是我做了一个 DSH 插件,让你的智能体直接住进聊天软件:

- 🐦 飞书 / Lark:官方 WebSocket 长连接,无需公网地址,秒级收发
- 💼 企业微信:官方加密回调,企业内网也能用
- ✈️ Telegram:Bot API 长轮询
- 💬 一个聊天一个智能体:多轮上下文、消息排队不串线、空闲自动释放
- 🔒 白名单安全:只允许指定的人驱动你的 agent

安装只需一条命令:dsh plugin add dsh-im-hub

⭐ GitHub:https://github.com/ThreeBody6666/dsh-im-hub
📦 npm:https://www.npmjs.com/package/dsh-im-hub

已提交到 DSH 官方插件社区收录(PR 审核中),欢迎 Star / PR / 提需求!

### 详细版(公众号 / CSDN / 知乎专栏)

标题:《我写了个 DSH 插件,把 DeepSeek 智能体搬进了 IM 聊天软件》

开头钩子:
"你有没有这种感觉——在终端里和 AI 智能体聊得正欢,一关电脑,对话就断了?我决定把它搬进每天都开着的微信生态里。"

正文大纲:
1. 为什么做:终端智能体离开电脑就失联;社区已有方案多依赖非官方网关(封号风险)
2. 做了什么:官方 API 优先——飞书 WebSocket 长连接、企业微信加密回调、Telegram 长轮询
3. 怎么做的:Cordis 插件架构、每聊天一个 agent 会话、session/event 流式回传、命令系统(/help /reset /status /model)
4. 踩坑实录:飞书长连接居然是 protobuf 二进制帧(不是 JSON);客户端要主动发心跳;事件 3 秒内必须 ACK 否则重推;企业微信回调是 AES-256-CBC + SHA1 验签
5. 实测效果:消息秒级往返,6×7=42、12×12=144 秒回
6. 怎么用:一条命令安装 + 三行配置(白名单必配!)
7. 结尾:开源地址 + 求 Star + 求 PR

安装方式:
```bash
dsh plugin --profile im add dsh-im-hub
```

配置示例(profile 的 cordis.patch.yml):
```yaml
- id: dsh-im-hub
  disabled: false
  config:
    adapters:
      feishu:
        enabled: true
        appId: 'cli_xxx'
        appSecret: 'xxx'
        allowedUserIds: ['ou_xxx']   # 白名单,必配!
```

## 🌍 English Copy

### Short (Twitter / X / Mastodon)

🚀 dsh-im-hub: turn your DeepSeek Harness agent into an IM assistant — Feishu/Lark (official WebSocket long connection, no public URL needed), WeCom (WeChat Work), and Telegram. One agent per chat, whitelist access, idle reaping.

Install: `dsh plugin add dsh-im-hub`

⭐ github.com/ThreeBody6666/dsh-im-hub

### Standard (Hacker News / r/LocalLLaMA / r/selfhosted)

I built dsh-im-hub, an open-source plugin that bridges DeepSeek Harness agents into Feishu (Lark), WeCom (WeChat Work), and Telegram.

- Official APIs only — Feishu WebSocket long connection (no public endpoint needed), WeCom AES-encrypted callbacks, Telegram long polling
- Per-chat agent sessions with multi-turn context and idle reaping
- Whitelist access control by design
- Install: `dsh plugin add dsh-im-hub`

The Feishu long-connection protocol turned out to be protobuf binary frames with client-driven pings and a 3s event ACK — I wrote a minimal codec for it with zero SDK dependency (tests included). The international Lark edition works too.

Feedback & PRs welcome!

## 📸 配图建议

1. 架构图:`IM 平台 ⇄ 适配器 ⇄ Bridge ⇄ Agent 会话(每聊天一个)`
2. 演示截图:手机聊天软件里与 bot 对话,AI 秒回结果的截图
3. 安装命令截图:终端 `dsh plugin add dsh-im-hub` 成功输出
4. Logo/仓库卡片:GitHub 仓库的 og:image

## 🎯 投放渠道建议

| 渠道 | 用哪个版本 | 备注 |
|---|---|---|
| 掘金 | 标准版 | 加 #DeepSeek #开源 #AI 标签 |
| 知乎 | 标准版/详细版 | 问题化标题更吸睛 |
| V2EX | 标准版 | 「分享创造」节点 |
| 微信公众号 | 详细版 | 配架构图+演示截图 |
| CSDN | 详细版 | 技术细节可再展开 |
| Twitter/X | 英文短版 | @DeepSeek 官方号 + #DeepSeek #OpenSource |
| Reddit r/LocalLLaMA | 英文标准版 | 加系统架构细节 |
| Hacker News | 英文标准版 | Show HN 前缀 |
| 即刻/朋友圈 | 一句话版 | 配演示截图 |

## 📌 文案要点提示

- 安全提示一定提:白名单必配(空=任何人都能驱动 agent)
- 差异化卖点:官方 API、无需公网、多平台、每会话独立上下文
- 与社区其他插件的区别:首个同时支持飞书+企微+Telegram 官方 API 的多平台网关;飞书长连接免公网
