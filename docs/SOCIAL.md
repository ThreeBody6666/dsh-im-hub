# 📣 dsh-im-hub 发布包（直接复制粘贴用）

> 全部素材已就绪：npm 0.2.0 ✅ / GitHub Release v0.2.0 ✅ / 3 个列表收录 ✅ / 社交预览图 ✅

---

## 🇨🇳 微信朋友圈 / 即刻（一句话）

我把 DeepSeek Harness 接进了飞书/企微/Telegram，现在可以在聊天软件里直接指挥 AI 智能体干活了 🚀
开源插件 dsh-im-hub v0.2.0 已发布，带 GUI 可视化配置卡片。
👉 https://github.com/ThreeBody6666/dsh-im-hub

## 🇨🇳 掘金 / 知乎 / V2EX（标准版）

【开源】dsh-im-hub —— 把 DeepSeek Harness 智能体接入飞书、企业微信、Telegram

平时在终端里和 AI 智能体对话，离开电脑就断了。于是我做了一个 DSH 插件，让你的智能体直接住进聊天软件：

- 🐦 飞书 / Lark：官方 WebSocket 长连接，无需公网地址，秒级收发
- 💼 企业微信：官方加密回调，企业内网也能用
- ✈️ Telegram：Bot API 长轮询
- 💬 一个聊天一个智能体：多轮上下文、消息排队不串线、空闲自动释放
- 🔒 白名单安全：只允许指定的人驱动你的 agent
- 🎛️ v0.2.0 新增：GUI 可视化设置卡片——浏览器点几下配好，凭据只写不回显，保存即热生效

安装只需一条命令：
```bash
dsh plugin add dsh-im-hub
```

🔗 GitHub：https://github.com/ThreeBody6666/dsh-im-hub
📦 npm：https://www.npmjs.com/package/dsh-im-hub
🏷️ Release：https://github.com/ThreeBody6666/dsh-im-hub/releases/tag/v0.2.0

已收录进 DSH 插件社区 3 个精选列表，欢迎 Star / PR / 提需求！

标签：`#DeepSeek` `#开源` `#AI` `#飞书` `#Telegram`

## 🇺🇸 Twitter/X（短版）

🚀 dsh-im-hub: turn your DeepSeek Harness agent into an IM assistant — Feishu/Lark (official WebSocket long connection, no public URL needed), WeCom, and Telegram. One agent per chat, whitelist access.

New in v0.2.0: visual settings card in the web GUI — configure from the browser, secrets write-only, save = hot reload.

Install: `dsh plugin add dsh-im-hub`
🔗 github.com/ThreeBody6666/dsh-im-hub

#DeepSeek #OpenSource #AIAgents #Telegram #Feishu

## 🇺🇸 Reddit r/LocalLLaMA + r/selfhosted（标准版）

I built dsh-im-hub, an open-source plugin that bridges DeepSeek Harness agents into Feishu (Lark), WeCom (WeChat Work), and Telegram.

- Official APIs only — Feishu WebSocket long connection (no public endpoint needed), WeCom AES-encrypted callbacks, Telegram long polling
- Per-chat agent sessions with multi-turn context and idle reaping
- Whitelist access control by design
- v0.2.0: visual settings card in the DSH web GUI — configure from the browser, credentials write-only, save hot-reloads the bridge
- Install: `dsh plugin add dsh-im-hub`

The Feishu long-connection protocol turned out to be protobuf binary frames with client-driven pings and a 3s event ACK — I wrote a minimal codec for it with zero SDK dependency (tests included). The international Lark edition works too.

🔗 https://github.com/ThreeBody6666/dsh-im-hub
🏷️ Release: https://github.com/ThreeBody6666/dsh-im-hub/releases/tag/v0.2.0

## 🇺🇸 Hacker News（Show HN 版）

Show HN: dsh-im-hub — Multi-platform IM gateway for DeepSeek Harness (Feishu/Lark, WeCom, Telegram)

I built a plugin that lets you chat with your DeepSeek Harness agent from Feishu, WeCom (WeChat Work), or Telegram — one agent session per chat, whitelist access, idle reaping. No public endpoint required: Feishu uses the official WebSocket long connection (protobuf frames, 3s ACK, client keepalive), Telegram uses long polling, WeCom uses AES-encrypted callbacks.

v0.2.0 adds a visual settings card in the web GUI — configure everything from the browser, secrets are write-only, saving hot-reloads the bridge.

Install: `dsh plugin add dsh-im-hub`
Repo: https://github.com/ThreeBody6666/dsh-im-hub

---

## 📸 配图素材

| 素材 | 位置 |
|---|---|
| 社交预览图（1280x640） | `docs/social-preview.png` |
| Telegram 配置截图 | `docs/images/settings-guidance-telegram.png` |
| 飞书配置截图 | `docs/images/settings-guidance-feishu.png` |
| 企微配置截图 | `docs/images/settings-guidance-wecom.png` |
