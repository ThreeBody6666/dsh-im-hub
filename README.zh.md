# dsh-im-hub

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) 的多平台 IM 网关插件:把 dsh 智能体接入 **飞书(Lark)**、**企业微信(WeCom)** 和 **Telegram**,让你在平时用的聊天软件里直接和智能体对话。

> 每个会话一个智能体、多轮上下文、白名单访问控制、空闲自动回收。默认无需公网地址(飞书长连接 / Telegram 长轮询;企业微信走 HTTP 回调)。

## 特性

- **飞书** — 官方 WebSocket 长连接(`/callback/ws/endpoint` + protobuf 帧、客户端主动 ping 保活、3 秒事件应答、message_id 幂等去重),或 webhook 模式。默认模式不需要公网地址。
- **企业微信** — 应用消息回调,完整实现 `WXBizMsgCrypt`(AES-256-CBC 解密 + SHA1 验签),并通过消息 API 主动回复。
- **Telegram** — Bot API 长轮询(`getUpdates`),超长消息自动按 4096 字符分片。
- **Mock 适配器** — 无需任何真实平台凭据,通过 stdin + 本地 HTTP 端点即可测试。
- 每个聊天一个 agent 会话:保留上下文、同一聊天串行处理(不交错)、空闲超时后自动释放。
- 所有适配器强制白名单(`allowedUserIds`);留空 = 允许所有人(生产环境请务必配置)。
- 聊天内命令:`/help`、`/reset`、`/status`、`/model`。

## 安装

```bash
# 从 Git 仓库安装(需要 prepare 脚本 + 构建授权)或 npm 包:
dsh plugin --profile im add github:yourname/dsh-im-hub

# 从本地源码安装(开发调试):
dsh plugin --profile im add link:D:/projects/dsh-im-hub
```

这会创建一个 headless profile `im`,bundle 为 `@deepseek-ai/dsh-base` + `dsh-im-hub`。启动:

```bash
dsh --profile im
```

## 配置

插件行默认禁用。在 profile 自己的 `cordis.patch.yml`(`$DSH_HOME/profiles/im/cordis.patch.yml`)中启用:

```yaml
- id: im-gateway
  disabled: false
  config:
    adapters:
      telegram:
        enabled: true
        token: '123456:ABC-DEF...'
        allowedUserIds: [123456789]        # Telegram 数字用户 id;留空 = 所有人
```

完整配置项:

| 键 | 默认值 | 说明 |
|---|---|---|
| `adapters.telegram.enabled` | `false` | 启用 Telegram Bot API 适配器(长轮询)。 |
| `adapters.telegram.token` | `''` | 来自 [@BotFather](https://t.me/BotFather) 的 Bot token。 |
| `adapters.telegram.allowedUserIds` | `[]` | 允许对话的数字用户 id。 |
| `adapters.telegram.timeoutSeconds` | `50` | `getUpdates` 长轮询超时。 |
| `adapters.telegram.pollIntervalMs` | `500` | 轮询超时/出错后的间隔。 |
| `adapters.feishu.enabled` | `false` | 启用飞书适配器。 |
| `adapters.feishu.appId` / `appSecret` | `''` | 飞书自定义应用凭据。 |
| `adapters.feishu.mode` | `'websocket'` | `websocket`(官方长连接,无需公网)或 `webhook`。 |
| `adapters.feishu.webhookPath` | `'/feishu'` | webhook 模式的 HTTP 路径。 |
| `adapters.feishu.verificationToken` | `''` | webhook 事件校验 token。 |
| `adapters.feishu.allowedUserIds` | `[]` | 允许对话的 open_id。 |
| `adapters.wecom.enabled` | `false` | 启用企业微信应用消息回调适配器。 |
| `adapters.wecom.corpId` / `corpSecret` / `agentId` | `''` | 企业微信应用凭据。 |
| `adapters.wecom.token` / `encodingAesKey` | `''` | 后台「接收消息」配置的 Token / EncodingAESKey。 |
| `adapters.wecom.path` | `'/wecom'` | HTTP 回调路径。 |
| `adapters.wecom.allowedUserIds` | `[]` | 允许对话的用户 id。 |
| `adapters.mock.enabled` | `false` | 仅测试用适配器(stdin + 本地 HTTP)。 |
| `adapters.mock.port` | `0` | mock 端点固定端口(`0` = 随机)。 |
| `agent.cwd` | `''` | agent 会话工作目录(默认 dsh 进程 cwd)。 |
| `agent.provider` / `agent.model` | `''` | 覆盖模型选择;留空 = 部署默认。 |
| `agent.maxMessageLength` | `4000` | 单条外发消息最大字符数(超出自动拆分)。 |
| `agent.idleTimeoutMs` | `1800000` | 聊天空闲多久后释放 agent(0 = 永不)。 |
| `agent.instructionPrefix` | `''` | 附加到每条用户消息前的前缀。 |
| `http.host` / `http.port` | `0.0.0.0` / `8080` | webhook 模式 HTTP 服务绑定地址(飞书 webhook / 企微回调)。 |

### 飞书前置条件

- 在[飞书开放平台](https://open.feishu.cn)创建企业自建应用,订阅 **`im.message.receive_v1`** 事件,并开通消息权限(`im:message:send_as_bot`、`im:message:p2p_msg`、`im:message:group_msg` / `group_at_msg`)。
- 长连接模式仅企业自建应用可用;在开发者后台事件订阅里选择「使用长连接接收事件」,或配置 webhook 请求地址。

### 企业微信前置条件

- 在企业微信管理后台创建应用,配置「接收消息服务器」:URL 填 `https://你的公网地址/wecom`,随机 Token 和 43 位 EncodingAESKey 填入配置。
- 企业微信没有长连接模式,回调服务器需要公网 HTTPS 地址(或隧道)。

## 聊天命令

| 命令 | 作用 |
|---|---|
| `/help` | 显示命令帮助。 |
| `/reset` | 清空当前聊天的对话上下文(重建 agent)。 |
| `/status` | 显示活跃会话 / 智能体 / 适配器。 |
| `/model` | 显示当前模型选择。 |

## 工作原理

```
IM 平台 ──(适配器)──► Bridge ──► ctx.agents.create({ sessionId })
   ▲                          │                │
   └──── 回复文本 ◄───────────┴── session/event 监听 ◄── agent 回合
```

- 每个 `platform:chatId` 对应一个 agent 会话(参照 `@deepseek-ai/dsh-headless`,但按聊天常驻)。
- 入站 IM 消息以 `source.kind = 'plugin'` / `form = 'relay'` 注入会话(社区惯例);出站文本通过 `session/event`(`assistant/message`,按回合聚合后按 `maxMessageLength` 分片)读回。
- 同一聊天的回合通过 busy-promise 链串行,消息排队避免交错。
- 空闲 agent 在 `agent.idleTimeoutMs` 后被释放,下一条消息到来时重建。

## 安全说明

- **务必配置白名单。** 每个启用适配器的 `allowedUserIds` 都要设置;留空意味着任何人都能驱动你的智能体——而它可以执行主机上的工具。
- IM 消息以插件来源的用户消息注入会话,不绕过部署自身的审批/护栏策略,请视同普通用户输入对待。
- 平台密钥(`token`、`appSecret`、`encodingAesKey`)存放在 profile 的 `cordis.patch.yml` 中,请保持该文件私密。

## 开发

```bash
node --test test/                          # 单元测试(protobuf 帧编解码)
dsh plugin --profile im add link:D:/projects/dsh-im-hub   # 从源码安装
dsh --profile im --patch test/disable-skin.overlay.yml         # 带 mock 适配器启动
# 发送消息:curl -X POST http://127.0.0.1:9099/mock -H 'content-type: application/json' -d '{"text":"hi","chatId":"test"}'
```

> 提示:如果 dsh-skin 管理器(`$DSH_HOME/cordis.patch.yml`)插入的 UI 皮肤行在你的 headless profile 中无法解析,请用 `--patch` overlay 禁用它(参考 `test/disable-skin.overlay.yml`)——home 层优先于 profile 层,overlay 才是可靠的禁用位置。

## License

MIT
