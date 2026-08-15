# 📣 dsh-im-hub 发布包（最终版 v0.2.0）

> 状态：npm 0.2.0 ✅ / GitHub Release v0.2.0 ✅ / 3 个社区列表已收录 ✅ / GUI 可视化设置卡片 ✅ / 社交预览图 ✅

---

## 🇨🇳 微信朋友圈 / 微信群 / 即刻（一句话版）

我把 DeepSeek Harness 接进了飞书/企微/Telegram，现在可以在聊天软件里直接指挥 AI 智能体干活了 🚀

开源插件 dsh-im-hub v0.2.0 已发布：官方 API、无需公网、白名单安全，还带 GUI 可视化配置卡片，浏览器点几下就配好。

👉 https://github.com/ThreeBody6666/dsh-im-hub

---

## 🇨🇳 掘金 / 知乎 / V2EX（标准版）

【开源】dsh-im-hub —— 把 DeepSeek Harness 智能体接入飞书、企业微信、Telegram

平时在终端里和 AI 智能体对话，离开电脑就断了。于是我做了一个 DSH 插件，让你的智能体直接住进聊天软件：

- 🐦 飞书 / Lark：官方 WebSocket 长连接（protobuf 帧 + 3 秒 ACK），无需公网地址，秒级收发；国际版 Lark 通用
- 💼 企业微信：官方 AES 加密回调（完整 WXBizMsgCrypt），企业内网也能用
- ✈️ Telegram：Bot API 长轮询，超长消息自动分片
- 💬 一个聊天一个智能体：多轮上下文、消息排队不串线、空闲自动释放
- 🔒 白名单安全：只允许指定的人驱动你的 agent（必配！）
- 🎛️ **v0.2.0 新增：GUI 可视化设置卡片**——在 DSH Web 设置页直接点选配置，凭据只写不回显（显示"已配置/未设置"徽标），保存即热生效，无需改 YAML、无需重启

安装只需一条命令：
```bash
dsh plugin --profile im add dsh-im-hub
```

🔗 GitHub：https://github.com/ThreeBody6666/dsh-im-hub
📦 npm：https://www.npmjs.com/package/dsh-im-hub
🏷️ Release：https://github.com/ThreeBody6666/dsh-im-hub/releases/tag/v0.2.0
🎨 社交预览图：https://github.com/ThreeBody6666/dsh-im-hub/blob/main/docs/social-preview.png

已收录进 DSH 插件社区 3 个精选列表（awesome-dsh-plugin / awesome-deepseek-harness / awesome-DSH-plugin），欢迎 Star / PR / 提需求！

标签：`#DeepSeek` `#开源` `#AI` `#飞书` `#Telegram` `#企业微信`

---

## 🇨🇳 微信公众号 / CSDN / 知乎专栏（详细版）

标题：《我写了个 DSH 插件，把 DeepSeek 智能体搬进了 IM 聊天软件》

开头钩子：
"你有没有这种感觉——在终端里和 AI 智能体聊得正欢，一关电脑，对话就断了？我决定把它搬进每天都开着的聊天软件里。"

正文大纲：
1. 为什么做：终端智能体离开电脑就失联；社区已有方案多依赖非官方网关（封号风险）
2. 做了什么：官方 API 优先——飞书 WebSocket 长连接、企业微信 AES 加密回调、Telegram 长轮询
3. 怎么做的：Cordis 插件架构、每聊天一个 agent 会话、session/event 流式回传、命令系统（/help /reset /status /model）
4. 踩坑实录：飞书长连接居然是 protobuf 二进制帧（不是 JSON）；客户端要主动发心跳；事件 3 秒内必须 ACK 否则重推；企业微信回调是 AES-256-CBC + SHA1 验签
5. 实测效果：消息秒级往返（6×7=42、12×12=144 秒回）
6. 怎么用：一条命令安装 + **GUI 可视化配置**（v0.2.0 新增：浏览器点选配置、凭据只写不回显、保存即热生效）
7. 结尾：开源地址 + 求 Star + 求 PR

安装方式：
```bash
dsh plugin --profile im add dsh-im-hub
```

---

## 🇺🇸 Twitter/X（短版）

🚀 dsh-im-hub: turn your DeepSeek Harness agent into an IM assistant — Feishu/Lark (official WebSocket long connection, no public URL needed), WeCom (WeChat Work), and Telegram. One agent per chat, whitelist access, idle reaping.

New in v0.2.0: a visual settings card in the DSH web GUI — configure from the browser, secrets write-only, save = hot reload.

Install: `dsh plugin --profile im add dsh-im-hub`
🔗 github.com/ThreeBody6666/dsh-im-hub

#DeepSeek #OpenSource #AIAgents #Telegram #Feishu

---

## 🇺🇸 Reddit r/LocalLLaMA + r/selfhosted（标准版）

I built dsh-im-hub, an open-source plugin that bridges DeepSeek Harness agents into Feishu (Lark), WeCom (WeChat Work), and Telegram.

- Official APIs only — Feishu WebSocket long connection (no public endpoint needed), WeCom AES-encrypted callbacks, Telegram long polling
- Per-chat agent sessions with multi-turn context and idle reaping
- Whitelist access control by design
- v0.2.0: visual settings card in the DSH web GUI — configure everything from the browser, credentials write-only, save hot-reloads the bridge
- Install: `dsh plugin --profile im add dsh-im-hub`

The Feishu long-connection protocol turned out to be protobuf binary frames with client-driven pings and a 3s event ACK — I wrote a minimal codec for it with zero SDK dependency (tests included). The international Lark edition works too.

🔗 https://github.com/ThreeBody6666/dsh-im-hub
🏷️ Release: https://github.com/ThreeBody6666/dsh-im-hub/releases/tag/v0.2.0

Now listed in 3 community awesome lists (awesome-dsh-plugin, awesome-deepseek-harness, awesome-DSH-plugin). Stars, PRs and feature requests welcome!

---

## 🇺🇸 Hacker News（Show HN 版）

Show HN: dsh-im-hub — Multi-platform IM gateway for DeepSeek Harness (Feishu/Lark, WeCom, Telegram)

I built a plugin that lets you chat with your DeepSeek Harness agent from Feishu, WeCom (WeChat Work), or Telegram — one agent session per chat, whitelist access, idle reaping. No public endpoint required: Feishu uses the official WebSocket long connection (protobuf frames, 3s ACK, client keepalive), Telegram uses long polling, WeCom uses AES-encrypted callbacks.

v0.2.0 adds a visual settings card in the DSH web GUI — configure everything from the browser, secrets are write-only, saving hot-reloads the bridge.

Install: `dsh plugin --profile im add dsh-im-hub`
Repo: https://github.com/ThreeBody6666/dsh-im-hub
Release: https://github.com/ThreeBody6666/dsh-im-hub/releases/tag/v0.2.0

---

## 📸 配图素材

| 素材 | 位置 |
|---|---|
| 社交预览图（1280x640，发帖封面） | `docs/social-preview.png` |
| Telegram 配置截图 | `docs/images/settings-guidance-telegram.png` |
| 飞书配置截图 | `docs/images/settings-guidance-feishu.png` |
| 企微配置截图 | `docs/images/settings-guidance-wecom.png` |

## 🎯 投放渠道速查

| 渠道 | 用哪个版本 | 备注 |
|---|---|---|
| 微信朋友圈 | 一句话版 | 配社交预览图 |
| 掘金 | 标准版 | 加 #DeepSeek #开源 #AI 标签 |
| 知乎 | 标准版/详细版 | 问题化标题更吸睛 |
| V2EX | 标准版 | 「分享创造」节点 |
| 微信公众号 | 详细版 | 配架构图+演示截图 |
| CSDN | 详细版 | 技术细节可再展开 |
| Twitter/X | 英文短版 | @DeepSeek 官方号 |
| Reddit r/LocalLLaMA | 英文标准版 | 加系统架构细节 |
| Hacker News | Show HN 版 | 标题加 Show HN: 前缀 |
| 即刻/朋友圈 | 一句话版 | 配演示截图 |
