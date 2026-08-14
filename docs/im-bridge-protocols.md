# IM 桥接插件协议文档:飞书 / 企业微信 / Telegram

> 用途:为 IM 桥接插件(Bridge)提供精确到 URL/字段/算法的接入协议说明。
> 依据:三大平台官方文档 + 官方/可靠开源实现(lark-oapi SDK、@larksuiteoapi/node-sdk、企业微信官方示例 WXBizMsgCrypt、wechatpy、python-telegram-bot、aiogram、gramio)。
> 标注:**「待验证」**表示该条目来自官方文档检索结果或社区官方答复,但本环境无法直连外网逐字核对页面原文,落地写代码前请打开对应官方文档 URL 核对。

---

## 0. 三平台总览

| 维度 | 飞书 | 企业微信 | Telegram |
|---|---|---|---|
| 接入方式 | 开放平台应用(自建应用/机器人) | 自建应用 | Bot(BotFather 创建) |
| 接收消息 | WebSocket 长连接(或 Webhook,二选一) | 应用消息回调(公网 URL + 加密) | 长轮询 getUpdates(或 Webhook,互斥) |
| 发送消息 | REST API(tenant_access_token) | REST API(access_token) | REST API(bot token) |
| 消息 ID 去重 | event_id / message_id | MsgId | update_id |
| 文本长度限制 | content 内 JSON 字符串(以各 msg_type 为准) | text.content ≤ 2048 字节 | text ≤ 4096 字符 |
| 心跳/保活 | 长连接:客户端定时发 ping 控制帧(默认 120s)+ 3s 内回事件响应帧 | 无(回调由企微主动推送) | 长轮询 timeout(1–50s) |
| 公网要求 | 长连接无需公网回调 URL | **必须**公网回调 URL | 长轮询无需公网;Webhook 需 HTTPS |

---

# 第一部分 飞书开放平台 —— WebSocket 长连接接收事件

> 官方文档索引:
> - 获取 tenant_access_token:https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal.md
> - 使用长连接接收事件:https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-subscription-configure-/request-url-configuration-case
> - 事件概述(事件结构/重试/幂等):https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM.md
> - 接收消息(im.message.receive_v1):https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
> - 发送消息(im/v1/messages):https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message/create
> - 消息 content 结构:https://open.feishu.cn/document/server-docs/im-v1/message-content-description/create_json.md
> - 获取长连接在线数量:https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-v1/connection/get
> - 官方 SDK 源码(协议事实标准):oapi-sdk-go [`ws/`](https://github.com/larksuite/oapi-sdk-go/tree/v3_main/ws)、oapi-sdk-python [`lark_oapi/ws/`](https://github.com/larksuite/oapi-sdk-python/tree/v2_main/lark_oapi/ws)、node-sdk [`ws-client/`](https://github.com/larksuite/node-sdk/tree/main/ws-client)

## 1.1 获取 tenant_access_token

### 1.1.1 请求

```
POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
Content-Type: application/json
```

| 字段 | 必填 | 说明 |
|---|---|---|
| app_id | 是 | 应用的 App ID(开发者后台「凭证与基础信息」,形如 `cli_xxxxxxxx`) |
| app_secret | 是 | 应用的 App Secret(与 app_id 配对) |

```bash
curl -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
  -H "Content-Type: application/json" \
  -d '{"app_id":"cli_xxx","app_secret":"xxx"}'
```

```js
const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
});
const data = await res.json();
```

### 1.1.2 响应

```json
{
  "code": 0,
  "msg": "success",
  "tenant_access_token": "t-xxxxxxxxxxxx",
  "expire": 7200
}
```

| 字段 | 说明 |
|---|---|
| code | 0 成功;非 0 失败(应用凭证类错误常见 `99991661`/`99991663`,其余见官方错误码文档) |
| msg | 错误描述 |
| tenant_access_token | 租户级凭证(以应用身份调用 API 用) |
| expire | 有效期秒,7200(2 小时) |

**要点**:token 必须**缓存**;**剩余有效期 < 30 分钟时提前刷新**(此时再调用会返回新 token,新旧并存;剩余 ≥ 30 分钟时返回原 token);多实例并发刷新会互相顶号,用锁/单例管理;调用需要 tenant_access_token 的 API 时放 Header `Authorization: Bearer <token>`。

## 1.2 建立 WebSocket 长连接(接收事件)

> 协议事实标准 = 官方 SDK 源码(oapi-sdk-go `ws/`、oapi-sdk-python `lark_oapi/ws/`、node-sdk `ws-client/`),以下内容已对照源码核实。

### 1.2.1 获取长连接地址(建连端点)

```
POST https://open.feishu.cn/callback/ws/endpoint
Content-Type: application/json
```

请求体(**字段名是 PascalCase:AppID / AppSecret**,与其余 API 的 snake_case 不同):

```json
{
  "AppID": "cli_xxx",
  "AppSecret": "xxx"
}
```

> 不需要 `Authorization` header,凭据放在请求体。注意:当前官方 SDK 使用的端点是 **`/callback/ws/endpoint`**;部分旧资料中的 `/open-apis/event/v1/websocket` 为历史端点(待验证是否仍可用)。

响应:

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "URL": "wss://xxx?device_id=xxx&service_id=123",
    "ClientConfig": {
      "ReconnectCount": -1,
      "ReconnectInterval": 120,
      "ReconnectNonce": 30,
      "PingInterval": 120
    }
  }
}
```

| 字段 | 说明 |
|---|---|
| data.URL | wss 服务端地址(**字段名大写 URL**);query 携带 `device_id`、`service_id`(心跳帧需要 service_id) |
| data.ClientConfig | 可选,服务端下发的连接控制参数:ReconnectCount(重连次数,-1=无限)/ ReconnectInterval(重连间隔秒)/ ReconnectNonce(首次重连随机抖动秒)/ PingInterval(心跳间隔秒) |

建连错误码:`0` OK、`1` system busy、`403` Forbidden、`514` AuthFailed、`1000040343` 内部错误、`1000040350` 连接数超限(每应用最多 50 个连接)。握手失败时 HTTP 响应头带 `Handshake-Status` / `Handshake-Msg` / `Handshake-Autherrcode`。

直接用 `data.URL` 发起 WebSocket 连接即可,无需额外 header/鉴权。

### 1.2.2 帧协议(protobuf 二进制,不是 JSON 文本)

- 每条 WS **binary** 消息 = 一个 protobuf 消息 `Frame`(官方 SDK 中的 `pbbp2.Frame`,无额外长度前缀),字段:

| Frame 字段 | 类型 | 说明 |
|---|---|---|
| SeqID | uint64 | 客户端 ping 时为 0 |
| LogID | uint64 | 客户端 ping 时为 0 |
| service | int32 | = wss URL 的 `service_id` |
| method | int32 | `0`=control 控制帧,`1`=data 数据帧 |
| headers | repeated {key,value} | 见下表 |
| payload_encoding / payload_type | string | 可选 |
| payload | bytes | 事件 JSON / 响应 JSON |

- headers 常用 key:`type`(event / card / ping / pong)、`message_id`、`sum`(拆包数,未拆为 1)、`seq`(包序号)、`trace_id`(链路 ID)、`timestamp`(ms)、`instance_id`、`biz_rt`(业务处理耗时 ms)。
- **事件数据帧**:`method=1`、headers 含 `type=event` + `message_id` + `trace_id` + `sum` + `seq` + `timestamp`;payload 即事件 JSON(结构见 1.2.4)。
- **拆包**:`sum>1` 表示按 `message_id` + `seq` 分片推送,需合并(缓存约 5 秒)后再处理。
- **收到事件后必须回响应帧**(见 1.2.3),否则触发重推。

### 1.2.3 心跳与事件应答

**心跳(客户端主动 ping)**
- **由客户端定时主动发送 ping 控制帧**(与"服务端 ping、客户端回"相反):
  - 帧:`method=0`(control)、`service=<service_id>`、`SeqID=0`、`LogID=0`、`headers=[{key:"type",value:"ping"}]`、无 payload。
- **间隔**:默认 **120 秒**(`PingInterval`);服务端可通过 ①建连响应 `data.ClientConfig.PingInterval`、②pong 帧 payload 下发新值,客户端据此调整。
- **pong 帧**:服务端回的 control 帧,`headers=[{key:"type",value:"pong"}]`,`payload` = JSON `{"PingInterval":120,"ReconnectCount":-1,"ReconnectInterval":120,"ReconnectNonce":30}`。
- 服务端**也可能主动发 ping**,官方 SDK 收到后忽略、不回复(服务端超时断连的确切阈值待验证)。
- SDK 保活策略:ping 保活 + 读消息出错/超时即断线并自动重连(默认无限重试:首次重连前随机抖动 ReconnectNonce≈30s,之后每 ReconnectInterval≈120s 重试一次,参数可被服务端覆盖)。

**事件应答(关键!)**
- 收到事件后**必须在 3 秒内**回响应帧,否则触发重推(官方文档口径:**15s / 5min / 1h / 6h,最多 4 次**,精确间隔待验证);整体为"至少一次投递",成功也可能重复 → **处理必须幂等**。
- 响应帧构造:复用原帧的 `SeqID/LogID/service/method/headers`,追加 header `biz_rt`(处理耗时 ms),`payload` = JSON `{"code":200}`(失败 `{"code":500}`;卡片回调有返回值时 `data` 为 base64)。

**插件实现建议**:①按 PingInterval 定时发 ping 控制帧;②收到事件处理完成后回 `{"code":200}` 响应帧(≤3s,处理慢则先回 200 再异步处理);③断线自动重连(指数/固定退避,复用 ClientConfig);④用 `message_id` 幂等去重。

### 1.2.4 im.message.receive_v1 完整事件体

```json
{
  "schema": "2.0",
  "header": {
    "event_id": "5e3702a84e847582be8db7fb73283c02",
    "event_type": "im.message.receive_v1",
    "create_time": "1608725989000",
    "token": "rvaYgkND1GOiu5MM0E1rncYC6PLtF7JV",
    "app_id": "cli_xxx",
    "tenant_key": "2ca1d211f64f6438"
  },
  "event": {
    "sender": {
      "sender_id": {
        "union_id": "on_xxx",
        "user_id": "e33ggbyz",
        "open_id": "ou_xxx"
      },
      "sender_type": "user",
      "tenant_key": "736588c9260f175e"
    },
    "message": {
      "message_id": "om_5ce6d572455d361153b7cb51da133945",
      "root_id": "om_xxx",
      "parent_id": "om_xxx",
      "create_time": "1609073151345",
      "update_time": "1687343654666",
      "chat_id": "oc_xxx",
      "thread_id": "omt_d4be107c616",
      "chat_type": "group",
      "message_type": "text",
      "content": "{\"text\":\"@_user_1 hello\"}",
      "mentions": [
        {
          "key": "@_user_1",
          "id": { "union_id": "on_xxx", "user_id": "e33ggbyz", "open_id": "ou_xxx" },
          "mentioned_type": "user",
          "name": "Tom",
          "tenant_key": "736588c9260f175e"
        }
      ],
      "user_agent": "Mozilla/5.0 ..."
    }
  }
}
```

| event 字段 | 说明 |
|---|---|
| header.event_id | 事件唯一 ID(注意:官方建议**用 message_id 幂等,不要依赖 event_id**) |
| header.event_type / create_time / app_id / tenant_key | 事件类型 / 事件时间(ms 字符串)/ 应用 / 租户 |
| sender.sender_id.open_id / union_id / user_id | 发送者 ID(按应用权限返回;通常只有 open_id) |
| sender.sender_type | `user` / `bot` |
| message.message_id | 消息 ID(`om_` 开头),全局唯一,**幂等去重键** |
| message.root_id / parent_id | 回复线程根消息 / 父消息 ID(非回复为空) |
| message.create_time / update_time | 创建 / 更新时间(毫秒时间戳字符串) |
| message.chat_id | 会话 ID(`oc_` 开头) |
| message.thread_id | 话题 ID(`omt_` 开头,话题群才有) |
| message.chat_type | `p2p`(单聊)/ `group`(群聊) |
| message.message_type | `text` / `post` / `image` / `file` / `audio` / `interactive` / `system` 等 |
| message.content | **JSON 字符串**,需按 message_type 二次 JSON.parse;如 text 为 `{"text":"..."}` |
| message.mentions | @ 提及列表:`key`(形如 `@_user_1`)、`id`、`mentioned_type`、`name`、`tenant_key` |
| message.user_agent | 发送端 UA(需额外权限 `im:user_agent:read`) |

> 注意:事件里的 `content` 是**序列化后的 JSON 字符串**(与发送时一致),解析事件时先 `JSON.parse(message.content)` 再取字段;幂等请用 `message_id`。

## 1.3 主动发送消息(im/v1/messages)

### 1.3.1 请求

```
POST https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id
Authorization: Bearer <tenant_access_token>
Content-Type: application/json
```

| query 参数 | 必填 | 说明 |
|---|---|---|
| receive_id_type | 是 | `open_id` / `user_id` / `union_id` / `email` / `chat_id`(与 body 的 receive_id 类型一致) |

| body 字段 | 必填 | 说明 |
|---|---|---|
| receive_id | 是 | 接收方 ID(按 receive_id_type 解释:单聊传用户 open_id,群聊传 chat_id) |
| msg_type | 是 | `text` / `post` / `image` / `interactive` / `file` / `audio` / `media` 等 |
| content | 是 | **JSON 字符串**(先构造 JSON 对象再 `JSON.stringify`),不同 msg_type 结构不同;text ≤150KB,卡片/富文本 ≤30KB |
| uuid | 否 | 幂等键:相同 uuid 的请求 1 小时内只发一条 |

> **限频**:同一用户 5 QPS、同一群 5 QPS;接口级 1000 次/分、50 次/秒。常见错误码:`230001` 参数错误、`230002` 机器人不在群、`230006` 未开启机器人能力、`230013` 用户不在应用可用范围、`230034` receive_id 无效。

```bash
# 发送文本消息到单聊
curl -X POST "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id" \
  -H "Authorization: Bearer <tenant_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"receive_id":"ou_xxx","msg_type":"text","content":"{\"text\":\"你好\"}"}'
```

```js
await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${tenantAccessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    receive_id: 'ou_xxx',
    msg_type: 'text',
    content: JSON.stringify({ text: '你好' }),   // content 必须是 JSON 字符串!
  }),
});
```

**content 结构速查**(均为 JSON 字符串):

| msg_type | content(序列化前) |
|---|---|
| text | `{"text":"你好 <at user_id=\"ou_xxx\">名字</at>"}`(@all 用 `<at user_id=\"all\"></at>`) |
| post | `{"zh_cn":{"title":"标题","content":[[{"tag":"text","text":"正文"}]]}}` |
| image | `{"image_key":"img_xxx"}` |
| file | `{"file_key":"file_xxx"}` |
| interactive | 卡片 JSON |

### 1.3.2 响应

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "message_id": "om_xxx",
    "root_id": "",
    "parent_id": "",
    "msg_type": "text",
    "create_time": "1608725987000",
    "update_time": "1608725987000",
    "deleted": false,
    "sender": { "id": "cli_xxx", "id_type": "app_id", "sender_type": "app" },
    "body": { "content": "{\"text\":\"你好\"}" },
    "mentions": []
  }
}
```

**权限要求**(在开发者后台「权限管理」开通,发布应用版本后生效):
- 发送消息(应用/机器人身份,三选一即可):**`im:message:send_as_bot`** / `im:message` / `im:message:send`(历史版本);以用户身份发送需 `im:message` + `im:message.send_as_user`。
- 接收消息事件(按场景):
  - 单聊:`im:message.p2p_msg` 或 `im:message.p2p_msg:readonly`;
  - 群聊 @机器人:`im:message.group_at_msg`(要收其他机器人 @ 的消息再加 `im:message.group_at_msg.include_bot:readonly`);
  - 群聊全部消息:`im:message.group_msg`(含 include_bot 变体);
  - 可选:`im:user_agent:read`(取 user_agent)、`contact:user.employee_id:readonly`(取 user_id 字段)。

## 1.4 事件订阅配置(开发者后台)

1. 打开 https://open.feishu.cn 开发者后台 → 创建/进入「企业自建应用」(⚠️ **长连接仅支持企业自建应用;商店应用只能用 Webhook**)。
2. 「**添加应用能力**」→ 添加「**机器人**」能力(收发消息必须有机器人),然后**发布版本**。
3. 「**权限管理**」→ 按 1.3.2 清单开通(单聊 / 群聊@ / 群聊全部 / 发送),发布版本后生效。
4. 「**事件与回调**」→「**事件配置**」:
   - 订阅方式选「**使用长连接接收事件**」(⚠️ 保存时必须已有长连接在线,否则保存失败;长连接与 Webhook **二选一**,长连接模式**无需配置请求网址/回调 URL**);
   - 「消息与群组」分类下添加事件「**接收消息 v2.0**」(`im.message.receive_v1`),可一键开通该事件所需权限;不要同时订阅 v1.0 与 v2.0 同一事件(会收到两份)。
5. 「**版本管理与发布**」→ 创建版本并发布,配置才生效(即使权限已审批)。
6. 可见范围:应用的「可用范围」需包含要通信的用户/部门,否则收不到也发不出(发送时报 `230013`)。
7. (可选)代码方式动态订阅事件:疑似 `GET/PUT /open-apis/event/v1/events`,精确路径/字段**待验证**;另有「获取长连接在线数量」`GET /open-apis/event/v1/connection`(https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-v1/connection/get)。

## 1.5 飞书 · 实现时的坑

1. **content 是 JSON 字符串不是对象**:发送时 `content` 必须 `JSON.stringify({text:"..."})` 后作为字符串传;接收事件时 `message.content` 也需 `JSON.parse` 再取字段(官方 Node 示例即 `JSON.parse(content).text`)。
2. **建连字段是 PascalCase**:请求体 `AppID`/`AppSecret`,响应 `URL`/`ClientConfig`,与其余 API 的 snake_case 不一致,别照抄 snake_case。
3. **帧是 protobuf 二进制**:必须实现 `pbbp2.Frame` 编解码(直接复用官方 SDK 的 pb 定义),不是 JSON 文本帧。
4. **3 秒内回 `{"code":200}` 响应帧**(SDK 源码确认必须回帧;未回会触发重推,官方文档口径 15s/5min/1h/6h 共 4 次,待验证);至少一次投递 → **必须幂等**。
5. **幂等用 `message_id`**(该事件官方文档明确不要依赖 `event_id`);同时不要重复订阅 v1.0 与 v2.0 同一事件(会收到两份)。
6. **token 缓存与刷新**:tenant_access_token 剩余有效期 < 30 分钟时提前刷新(新旧并存);缓存 + 锁防并发;Header 用 `Authorization: Bearer <token>`。
7. **长连接保活**:客户端定时发 ping 控制帧(默认 120s,以服务端下发的 PingInterval 为准)+ 断线自动重连(无限重试,参数来自 ClientConfig);重连前重新调用建连接口取新 URL。
8. **长连接与 Webhook 互斥**:二选一;保存后台订阅方式时需已有连接在线;长连接仅企业自建应用,商店应用只能 Webhook。
9. **receive_id_type 必须匹配**:receive_id 是 open_id 时 receive_id_type 必须传 `open_id`,否则报 `230034`/校验失败。
10. **机器人必须在会话中**:发群消息前机器人需已被拉入群(`230002`);单聊需用户先与机器人有会话;用户不在应用可用范围报 `230013`。
11. **open_id 是租户内唯一**:同一用户在不同企业(tenant)的 open_id 不同;跨租户场景用 union_id。
12. **事件里的 sender 只有 open_id**:要显示用户名需另调通讯录/联系人 API。
13. **限频**:同用户/同群 5 QPS、接口 1000 次/分;大批量发送要排队限速。
14. **权限/事件发布后才生效**:后台开通后必须「创建版本并发布」,企业内部应用一般即时生效(具体以控制台为准)。

# 第二部分 企业微信 —— 应用消息回调模式

> 官方文档索引:
> - 获取 access_token:https://developer.work.weixin.qq.com/document/path/91039
> - 发送应用消息:https://developer.work.weixin.qq.com/document/path/90236
> - 接收消息与事件概述:https://developer.work.weixin.qq.com/document/path/90238
> - 消息格式(明文 XML):https://developer.work.weixin.qq.com/document/path/90239
> - 事件格式:https://developer.work.weixin.qq.com/document/path/90240
> - 被动回复消息:https://developer.work.weixin.qq.com/document/path/101031
> - 加解密方案:https://developer.work.weixin.qq.com/document/path/96211 、https://developer.work.weixin.qq.com/document/path/101033
> - 加解密库下载与返回码:https://developer.work.weixin.qq.com/document/path/90307
> - 回调配置:https://developer.work.weixin.qq.com/document/path/91116
> - 官方示例代码:https://github.com/sbzhu/weworkapi_python

## 2.1 获取 access_token

### 2.1.1 请求

```
GET https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=ID&corpsecret=SECRET
```

| 参数 | 必填 | 说明 |
|---|---|---|
| corpid | 是 | 企业 ID,管理后台「我的企业」可查(形如 `ww1234567890abcdef`) |
| corpsecret | 是 | 应用的凭证密钥,「应用管理 → 自建应用 → 应用详情 → Secret」查看/重置 |

```bash
curl "https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=ww1234567890abcdef&corpsecret=YOUR_APP_SECRET"
```

```js
// Node.js fetch
const res = await fetch(
  "https://qyapi.weixin.qq.com/cgi-bin/gettoken" +
  "?corpid=" + encodeURIComponent(CORPID) +
  "&corpsecret=" + encodeURIComponent(CORPSECRET)
);
const data = await res.json();
```

### 2.1.2 响应

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "access_token": "accesstoken000001",
  "expires_in": 7200
}
```

| 字段 | 说明 |
|---|---|
| errcode | 0 成功;40001 secret 不合法;40013 corpid 不合法;60020 出口 IP 不在可信 IP 白名单 |
| errmsg | 错误描述 |
| access_token | 凭证,最长 512 字节(待验证) |
| expires_in | 有效期秒,正常 7200(2 小时) |

**要点**:有效期内重复获取返回相同结果;每个应用 token 独立;必须缓存并在过期前(建议提前 5–10 分钟)刷新,多实例用 Redis + 分布式锁防并发风暴;接口报 `42001`(token 过期)时刷新后重试一次。

## 2.2 主动发送应用消息

### 2.2.1 请求

```
POST https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=ACCESS_TOKEN
Content-Type: application/json; charset=utf-8
```

### 2.2.2 请求体(text 消息)

```json
{
  "touser": "UserID1|UserID2|UserID3",
  "toparty": "PartyID1|PartyID2",
  "totag": "TagID1|TagID2",
  "msgtype": "text",
  "agentid": 1000002,
  "text": {
    "content": "你的快递已到,请携带工卡前往邮件中心领取。"
  },
  "safe": 0
}
```

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| touser | 与 toparty/totag 至少一个非空 | string | 成员 ID 列表,`\|` 分隔,最多 1000 个(待验证);`@all` 表示全部成员(需应用有发送权限,且此时忽略 toparty/totag) |
| toparty | 同上 | string | 部门 ID 列表,`\|` 分隔,最多 100 个(待验证) |
| totag | 同上 | string | 标签 ID 列表,`\|` 分隔,最多 100 个(待验证) |
| msgtype | 是 | string | text / image / voice / video / file / textcard / news / mpnews / markdown / template_card 等(见 path/90248) |
| agentid | 是 | int | 应用 ID |
| text.content | 是(text) | string | **最长 2048 字节(UTF-8)**,超长截断;支持 `\n` 与 `<a href="...">` 标签 |
| safe | 否 | int | 0 否(默认)、1 保密消息 |

```bash
curl -X POST "https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"touser":"zhangsan|lisi","msgtype":"text","agentid":1000002,"text":{"content":"hello"}}'
```

### 2.2.3 响应

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "invaliduser": "userid1|userid2",
  "invalidparty": "partyid1",
  "invalidtag": "tagid1"
}
```

| 字段 | 说明 |
|---|---|
| errcode | 0 表示**受理成功**,不代表用户一定收到 |
| invaliduser / invalidparty / invalidtag | 投递失败的目标 ID |

常见错误码:40014 access_token 不合法;42001 过期;45009 发送频率超限;60011 无权限发该用户(不在应用可见范围);60020 IP 白名单。

**要点**:发送频率约 **30 次/分钟/应用**(超限 45009,精确条款待验证),大批量发送需排队限速;用户收不到常见原因:不在应用可见范围、未安装企业微信、被安全策略拦截。

## 2.3 接收回调:URL 验证(GET)

企微服务器向回调 URL 发两种请求:**GET(URL 验证,配置保存时触发)** 与 **POST(加密消息推送)**。

### 2.3.1 GET 参数

| 参数 | 说明 |
|---|---|
| msg_signature | 签名,校验请求合法性 |
| timestamp | 时间戳 |
| nonce | 随机串 |
| echostr | 加密的随机字符串(解密后为明文随机串) |

### 2.3.2 验证步骤

1. **验签**:对 `[token, timestamp, nonce, echostr]` **按字典序升序排序**后**直接拼接(无分隔符)**,做 SHA1 并 hex 编码,与 `msg_signature` 比对,不一致直接拒绝(403/空响应)。
2. **解密 echostr**:按 2.4 的 AES 流程解密,得到 `16字节随机串 + 4字节长度 + echostr原文 + corpid`,取出中间的 **echostr 原文**。
3. **响应**:把 echostr 原文**原样作为 HTTP 响应体**(纯文本,**不加引号、不带 BOM、不带换行符**,**1 秒内**返回)。

```js
// GET 验证 handler 伪代码(Node)
async function onVerify(req, res) {
  const { msg_signature, timestamp, nonce, echostr } = req.query;
  const expect = sha1([TOKEN, timestamp, nonce, echostr].sort().join(""));
  if (expect !== msg_signature) { res.status(403).end(); return; }
  const plain = decryptAes(echostr);   // 见 2.4
  const msg = extractMessage(plain);   // 去掉16字节随机串+4字节长度,尾部corpid
  res.status(200).send(msg);           // 原样返回,不要加引号/换行/BOM
}
```

## 2.4 消息加解密算法(WXBizMsgCrypt)

官方方案:path/96211、path/101033。自建应用「接收消息」上下行均为**加密传输**,必须实现全套(验签 + AES 解密 + AES 加密 + 签名)。

### 2.4.1 密钥派生

- 后台配置的 `EncodingAESKey` 为 **43 位**随机字符。
- 实际 AES 密钥:`AESKey = Base64_Decode(EncodingAESKey + "=")`(补一个 `=` 凑 44 字符后标准 Base64 解码)→ **32 字节**(AES-256)。
- 算法:**AES-256-CBC**;**IV = AESKey 前 16 字节**。

### 2.4.2 加密方向(构造密文,如被动回复)

```
明文 = random(16字节) + msg_len(4字节,网络字节序/大端) + 消息明文(XML) + receiveid(企业corpid)
```

1. 生成 16 字节随机串(每条消息不同)。
2. 消息明文(XML 字符串)UTF-8 字节长度写入 4 字节**大端**。
3. 拼接 receiveid(企业的 corpid,接收方校验用)。
4. 对整体做 **PKCS#7 填充,块大小为 32 字节**(不是标准 AES 的 16)。
5. AES-256-CBC 加密(密钥 32 字节,IV=密钥前 16 字节)。
6. **Base64 编码**得到 `msg_encrypt`。

### 2.4.3 解密方向(接收推送 / 验证 echostr)

```
1. Base64 解码 → 密文字节
2. AES-256-CBC 解密(密钥 32 字节,IV=密钥前16字节) → 带填充明文
3. 去掉 PKCS#7 填充(校验合法:末字节 p∈[1,32] 且末尾 p 字节全等于 p)
4. 解析:前16字节随机串丢弃;4字节大端长度 N;取 N 字节为明文;剩余为 receiveid,必须 == corpid
```

### 2.4.4 签名算法

```
msg_signature = sha1_hex( sort([token, timestamp, nonce, msg_encrypt]).join("") )
```

- 验证 URL 时用 `echostr` 代替 `msg_encrypt`;POST 时用 `Encrypt` 的值(**密文本身,不是解密后的明文**)。
- 排序为字典序升序,拼接**无分隔符**,SHA1 输出 40 位小写 hex。

### 2.4.5 Python 完整伪代码

```python
import base64, hashlib, struct, os
from Crypto.Cipher import AES

def get_aes_key(encoding_aes_key: str) -> bytes:
    return base64.b64decode(encoding_aes_key + "=")   # 43位+"=" -> 32字节

def pkcs7_pad(data: bytes, block_size: int = 32) -> bytes:
    pad = block_size - (len(data) % block_size)
    return data + bytes([pad]) * pad

def pkcs7_unpad(data: bytes, block_size: int = 32) -> bytes:
    pad = data[-1]
    if pad < 1 or pad > block_size or data[-pad:] != bytes([pad]) * pad:
        raise ValueError("bad padding")
    return data[:-pad]

def encrypt_msg(plain_xml: str, encoding_aes_key: str, corpid: str) -> str:
    key = get_aes_key(encoding_aes_key)
    raw = (os.urandom(16)
           + struct.pack(">I", len(plain_xml.encode("utf-8")))
           + plain_xml.encode("utf-8")
           + corpid.encode("utf-8"))
    cipher = AES.new(key, AES.MODE_CBC, key[:16])     # IV = 密钥前16字节
    return base64.b64encode(cipher.encrypt(pkcs7_pad(raw, 32))).decode()

def decrypt_msg(msg_encrypt: str, encoding_aes_key: str, corpid: str) -> str:
    key = get_aes_key(encoding_aes_key)
    cipher = AES.new(key, AES.MODE_CBC, key[:16])
    raw = pkcs7_unpad(cipher.decrypt(base64.b64decode(msg_encrypt)), 32)
    msg_len = struct.unpack(">I", raw[16:20])[0]      # random(16) + len(4,大端)
    xml = raw[20:20 + msg_len].decode("utf-8")
    receiveid = raw[20 + msg_len:].decode("utf-8")
    if receiveid != corpid:
        raise ValueError("receiveid mismatch (corpid)")
    return xml

def get_signature(token: str, timestamp: str, nonce: str, msg_encrypt: str) -> str:
    s = "".join(sorted([token, timestamp, nonce, msg_encrypt]))
    return hashlib.sha1(s.encode("utf-8")).hexdigest()
```

参考实现:官方 `WXBizMsgCrypt.py`(sbzhu/weworkapi_python)、wechatpy 的 `WeChatCrypto`;Node 侧用 `crypto` 时需 `setAutoPadding(false)` 手动做 32 字节 PKCS#7。

## 2.5 接收回调:POST 消息体 XML

企微 → 服务器(POST),body 为加密 XML:

```xml
<xml>
   <ToUserName><![CDATA[toUser]]></ToUserName>
   <AgentID><![CDATA[toAgentID]]></AgentID>
   <Encrypt><![CDATA[msg_encrypt]]></Encrypt>
</xml>
```

| 字段 | 说明 |
|---|---|
| ToUserName | 企业 corpid |
| AgentID | 应用 ID |
| Encrypt | Base64 密文,按 2.4 解密得到明文 XML |

处理流程:验签(`sort([token, timestamp, nonce, Encrypt值])` → sha1 → 与 query 的 `msg_signature` 比对)→ AES 解密 → 校验 receiveid == corpid → 解析明文 XML。

**明文 XML(text 消息)**:

```xml
<xml>
   <ToUserName><![CDATA[toUser]]></ToUserName>
   <FromUserName><![CDATA[fromUser]]></FromUserName>
   <CreateTime>1348831860</CreateTime>
   <MsgType><![CDATA[text]]></MsgType>
   <Content><![CDATA[this is a test]]></Content>
   <MsgId>1234567890123456</MsgId>
   <AgentID>1</AgentID>
</xml>
```

| 字段 | 说明 |
|---|---|
| ToUserName | 企业 corpid |
| FromUserName | 发送消息的成员 UserID |
| CreateTime | 消息创建时间(unix 秒) |
| MsgType | text(其他类型见 path/90239) |
| Content | 文本内容(UTF-8) |
| MsgId | 消息 ID,重试推送时不变,**用于去重** |
| AgentID | 应用 ID |

**POST 后回什么**:不需要被动回复时返回**空串**(HTTP 200 空 body)(部分场景提示需返回 `success`,待验证,建议默认空串,日志提示再调整);需要被动回复时在 **5 秒内**返回加密回复 XML(见 2.6)。

## 2.6 被动回复(下行)

- 必须在 **5 秒内**响应,否则企微重试,**总共重试 3 次**。
- 回复体必须为加密 XML:

```xml
<xml>
   <Encrypt><![CDATA[msg_encrypt]]></Encrypt>
   <MsgSignature><![CDATA[msg_signature]]></MsgSignature>
   <TimeStamp>1403610513</TimeStamp>
   <Nonce><![CDATA[nonce]]></Nonce>
</xml>
```

| 字段 | 说明 |
|---|---|
| Encrypt | 对明文回复 XML 按 2.4 加密后的 Base64 |
| MsgSignature | `sha1( sort([token, timestamp, nonce, msg_encrypt]).join("") )` |
| TimeStamp / Nonce | 自己生成 |

明文回复 XML(text):

```xml
<xml>
   <ToUserName><![CDATA[toUser]]></ToUserName>
   <FromUserName><![CDATA[fromUser]]></FromUserName>
   <CreateTime>1348831860</CreateTime>
   <MsgType><![CDATA[text]]></MsgType>
   <Content><![CDATA[this is a test]]></Content>
</xml>
```

(待验证:被动回复中 ToUserName/FromUserName 的取值方向,落地对照 path/101031。)

## 2.7 后台配置

1. 登录 https://work.weixin.qq.com/wework_admin/frame →「**应用管理**」→「**自建**」→ 选择/新建应用 →「应用详情」。
2. 找到「**接收消息**」→「**设置 API 接收**」,填写三项:
   - **URL**:公网可访问的回调地址(同时处理 GET 验证与 POST 推送)。
   - **Token**:自定义随机串,参与签名。
   - **EncodingAESKey**:43 位随机字符(页面有「随机生成」按钮)。
3. 点「保存」,企微立即向 URL 发 GET 验证;通过才保存成功,否则提示「openapi 回调地址请求不通过」。
4. (可选)配置需要接收的事件(见 path/90240)。

**URL 要求**:必须公网可达(内网/局域网不可用,调试用内网穿透);GET 验证需 1 秒内返回解密 echostr 原文;建议 HTTPS;企微回调来源 IP 固定,防火墙需放行(见 path/100079)。

## 2.8 企业微信 · 实现时的坑(Checklist)

1. **回调 URL 必须公网可达** —— 保存配置验证失败 90% 是 URL 不通或 GET 逻辑错误。
2. **验证响应格式**:返回解密后的 echostr 原文,不加引号/BOM/换行,**1 秒内**返回。
3. **验签失败排查顺序**:后台 Token 与代码一致;GET 用 `echostr`、POST 用 `Encrypt` 密文参与签名;排序后 `join` **无分隔符**;query 参数名大小写 `msg_signature/timestamp/nonce/echostr`;自拼 URL 转发注意 base64 含 `+ / =` 的 URL 编码。
4. **EncodingAESKey 不是密钥本身**:必须 `Base64_Decode(EncodingAESKey + "=")` 得 32 字节;IV = 前 16 字节。
5. **PKCS#7 块大小是 32**,不是 16;解密后校验 padding 与尾部 `receiveid == corpid`。
6. **XML 解析防 XXE**:禁用 DOCTYPE/外部实体(Python `defusedxml`、Node `fast-xml-parser` 关 `processEntities`、Java 开 SECURE_PROCESSING)。
7. **被动回复 5 秒超时重试 3 次**;回复必须是加密 XML(Encrypt/MsgSignature/TimeStamp/Nonce),不能回明文。
8. **幂等去重**:消息用 `MsgId`,事件类(无 MsgId)用 `FromUserName + CreateTime`。
9. **access_token 缓存**:7200 秒、每应用独立、提前刷新、加锁防并发;`42001` 时刷新重试。
10. **频率限制**:约 30 次/分钟/应用(待验证),超限 `45009`;大批量要限速。
11. **touser 语义**:`@all` 或 `|` 分隔;touser/toparty/totag 不能全空;`content` ≤ 2048 字节按 UTF-8 边界截断。
12. **errcode=0 不代表送达**:检查 `invaliduser`;用户收不到查应用可见范围。
13. **编码**:全部 UTF-8;中文 content 按字节计数。
14. **加解密库错误码**(path/90307):40001 签名错误 / 40002 XML 解析失败 / 40003 sha 失败 / 40004 AESKey 非法 / 40005 corpid 校验失败 / 40006 加密失败 / 40007 解密失败 / 40008 解密后 buffer 非法 / 40009/40010 base64 加解密失败 / 40011 生成 XML 失败。

---

# 第三部分 Telegram Bot API —— 长轮询模式

> 官方文档:https://core.telegram.org/bots/api 、https://core.telegram.org/bots 、https://core.telegram.org/bots/faq
> 交叉验证:aiogram、python-telegram-bot、gramio、telers。

## 3.0 基础

- 所有方法统一:**`POST https://api.telegram.org/bot<token>/<METHOD_NAME>`**(也支持 GET query,官方推荐 POST)。
- 参数支持 `application/x-www-form-urlencoded`、`multipart/form-data`(文件)或 JSON body。
- token 格式:`<数字bot_id>:<一串字符>`(如 `123456789:AAF...`),**是密钥**,泄露即失去 bot 控制权。
- 响应统一 JSON 信封:`{"ok": true, "result": ...}`;失败 `ok=false` + `error_code`(400/401/403/404/409/429)+ `description`;429 时带 `parameters.retry_after`(秒)。

## 3.1 getUpdates(长轮询)

### 3.1.1 请求

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/getUpdates" \
  -d "timeout=30" \
  -d "offset=123456" \
  -d "limit=100" \
  -d 'allowed_updates=["message","edited_message","callback_query"]'
```

```js
const res = await fetch('https://api.telegram.org/bot<TOKEN>/getUpdates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    timeout: 30,
    offset: 123456,
    limit: 100,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
  }),
});
```

### 3.1.2 参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| timeout | Integer | 否 | 长轮询秒数,默认 0(短轮询立即返回),**范围 1–50**,建议 30–50 |
| offset | Integer | 否 | **必须比已收到最大 update_id 大 1**(即 `max(update_id)+1`);传入更大的 offset 即视为确认了更早的更新;负数表示从队列末尾往回取并忘记更早更新 |
| limit | Integer | 否 | 最多返回数,**1–100,默认 100** |
| allowed_updates | Array\<String\> | 否 | 只接收列出的类型,如 `["message"]`;空数组=接收除 chat_member/message_reaction 等外的全部;不传沿用上次设置;设置只影响之后的更新 |

### 3.1.3 响应示例

```json
{
  "ok": true,
  "result": [
    {
      "update_id": 123456789,
      "message": {
        "message_id": 42,
        "from": { "id": 1234567, "is_bot": false, "first_name": "Alice", "username": "alice" },
        "chat": { "id": 1234567, "type": "private", "first_name": "Alice", "username": "alice" },
        "date": 1710000000,
        "text": "Hello bot"
      }
    }
  ]
}
```

长轮询超时无新更新时返回 `result: []`,不是错误。

### 3.1.4 Update / Message / User / Chat 关键字段

**Update**:`update_id`(Integer,唯一、全局单调递增)、`message`、`edited_message`、`channel_post`、`edited_channel_post`、`callback_query`(含 id/from/message/inline_message_id/data/chat_instance)、`inline_query`、`poll`、`my_chat_member`/`chat_member`(默认不接收,需在 allowed_updates 显式请求)、`chat_join_request` 等。

**Message**:`message_id`(必填,chat 内唯一)、`message_thread_id`、`from`(User,发送者)、`sender_chat`、`date`(必填,unix 秒)、`chat`(必填)、`reply_to_message`(嵌套 Message)、`text`(纯文本正文)、`caption`(媒体说明,0–1024)、`entities`/`caption_entities`、`reply_markup`、媒体字段(photo/video/document/audio/voice/sticker/animation/poll/location/contact 等)。

**User**:`id`、`is_bot`、`first_name`(必填)、`last_name`、`username`(无 @ 前缀)、`language_code`、`is_premium`(待验证)。

**Chat**:`id`(必填;**私聊/机器人 > 0,群组/超级群/频道 < 0**)、`type`(必填,private/group/supergroup/channel)、`title`(群/频道)、`username`、`first_name`/`last_name`、`is_forum`(待验证)。

## 3.2 sendMessage(发送文本)

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=1234567" \
  -d "text=Hello!" \
  -d "parse_mode=HTML" \
  -d "reply_to_message_id=42"
```

```js
await fetch('https://api.telegram.org/bot<TOKEN>/sendMessage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: '@my_channel',   // 频道 @username;群组/私聊数字 id
    text: 'Hello!',
    parse_mode: 'HTML',
    reply_to_message_id: 42,
  }),
});
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| chat_id | Integer/String | ✅ | 数字 id(群组为负)或频道 `@channelusername` |
| text | String | ✅ | 正文,实体解析后 **1–4096 字符** |
| parse_mode | String | 否 | `HTML` / `Markdown` / `MarkdownV2`(转义见 3.4) |
| entities | Array | 否 | 与 parse_mode 互斥 |
| reply_to_message_id | Integer | 否 | 回复指定消息(新版被 reply_parameters 替代,仍有效) |
| link_preview_options | Object | 否 | 链接预览(替代弃用的 disable_web_page_preview) |
| disable_notification | Boolean | 否 | 静默发送 |
| protect_content | Boolean | 否 | 禁止转发/保存 |
| reply_markup | Object | 否 | 内联/自定义键盘 |

响应:成功时 `result` 为完整 Message 对象。

## 3.3 editMessageText / deleteMessage(流式回复)

### 3.3.1 editMessageText

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/editMessageText" \
  -d "chat_id=1234567" \
  -d "message_id=43" \
  -d "text=Hello! Edited" \
  -d "parse_mode=HTML"
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| chat_id + message_id | — | 二选一 | 编辑普通消息 |
| inline_message_id | String | 二选一 | 编辑内联消息(与 chat_id/message_id 互斥) |
| text | String | ✅ | 新文本,1–4096 |
| parse_mode / entities / link_preview_options / reply_markup | — | 否 | 同 sendMessage |

- 响应:普通消息返回编辑后的 Message;内联消息返回 `true`。
- **只能编辑自己 bot 发的消息**;新文本与原文相同报 400 `Bad Request: message is not modified`(流式回复收尾内容没变时需忽略此错误)。

### 3.3.2 deleteMessage

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteMessage" \
  -d "chat_id=1234567" \
  -d "message_id=43"
```

| 参数 | 必填 | 说明 |
|---|---|---|
| chat_id | ✅ | 同上 |
| message_id | ✅ | 要删除的消息 |

响应:`{"ok": true, "result": true}`。限制:消息**发出超过 48 小时不可删除**;bot 只能删自己的消息(群管理员或超级群/频道有 can_delete_messages 权限可删任意消息)。

## 3.4 消息长度限制与 parse_mode 转义

- **text 上限 4096 字符**(实体解析后),超长必须**分片**:每片 ≤4096 逐条 sendMessage;切分不要切断 HTML/Markdown 标记。
- 媒体 `caption` 上限 **1024 字符**。
- **HTML**:只允许 `<b> <strong> <i> <em> <u> <ins> <s> <strike> <del> <a href> <code> <pre>`;文本中 `<`、`>`、`&` 必须转义为 `&lt;` `&gt;` `&amp;`;href 必须 HTTP(S)。
- **MarkdownV2**:18 个字符必须反斜杠转义:`_ * [ ] ( ) ~ ` > # + - = | { } . !`(如 `\_`、`\.`、`\!`)。
- **Markdown(旧版)**:仅 `*bold*` `_italic_` `` `code` `` `[text](url)`,易踩坑,新代码推荐 HTML 或 MarkdownV2。
- 转义错误返回 400 `Bad Request: can't parse entities: ...`,**消息不发送**,发送前务必本地转义。

## 3.5 创建 bot(BotFather)

1. Telegram 中私聊 **@BotFather**(https://t.me/botfather)。
2. 发送 **`/newbot`**;依次设置:显示名(可含空格)→ **用户名(必须以 `bot` 结尾,全平台唯一)**。
3. 成功后返回 token:`<数字id>:<约35位字母数字>`(如 `123456789:AAF...`)。
4. 管理命令:`/mybots` 管理;`/token` 重新生成(**旧 token 立即失效**,泄露后轮换);`/deletebot` 删除;`/setname`、`/setdescription`、`/setcommands` 等。
5. 取 chat_id:给 bot 发消息后从 getUpdates 的 `message.chat.id` 读取;群组/频道为负值。

## 3.6 webhook 与 getUpdates 互斥

- **同一 bot 同一时刻只能一种接收方式**。已设 webhook 再调 getUpdates 返回 **409**:
  ```json
  { "ok": false, "error_code": 409,
    "description": "Conflict: can't use getUpdates method while webhook is active" }
  ```
- 切长轮询前先删 webhook 并确认:
  ```bash
  curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
  curl -X POST "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
  ```
- `setWebhook` 要求 **HTTPS** URL(自签名证书用 `certificate` 参数上传)。
- **另一个 409 陷阱**:同一 bot 的 getUpdates 同时只允许一个长连接,第二个并发请求报 `Conflict: terminated by other getUpdates request`(多实例部署必须单实例或分布式锁)。

## 3.7 Telegram · 实现时的坑

1. **offset 语义**:必须持久化 `max(update_id)+1`;"确认"发生在**用更大 offset 调用 getUpdates 时**,不是处理完时。at-least-once 做法:先落库再推进 offset;处理失败不推进则重发。
2. **timeout ≤ 50**:HTTP 客户端 read timeout 必须大于长轮询 timeout(如 timeout=50 时客户端设 60–70s),否则客户端先超时造成空轮询循环。
3. **网络层重连**:长轮询连接会因网络抖动断开;捕获异常 sleep(1–5s 退避)重试,不要把瞬断当 fatal。
4. **4096 分片 + 转义**:超长分片;HTML 转义 `<>&`,MarkdownV2 转义 18 字符;不在标记中间切。
5. **频率限制**:约 30 条/秒到不同会话、同一群组约 20 条/分钟(待验证);超限 **429 + retry_after**,必须退避。
6. **webhook 残留 409**:迁移/重启先 deleteWebhook;防止多轮询实例并存。
7. **chat_id 形态**:数字 id(群组负值)或 `@channelusername`;`Bad Request: chat not found` 常见于 id 错或 bot 不在该会话。
8. **edit/delete 边界**:只能操作自己发的消息;>48h 不能删;editMessageText 内容未变报 400 `message is not modified`。
9. **parse_mode 双刃剑**:指定后所有特殊字符都要转义,否则 400 不发送;纯文本建议不传 parse_mode。
10. **allowed_updates 变更不立即生效**:只影响之后产生的更新,过滤逻辑要健壮。
11. **date 是 unix 秒**;update_id 全局递增而非每 chat 独立。
12. **token 轮换后 offset 失效风险**(社区实证):换 token 时重置 offset 状态,防止漏消息。

---

## 附:三平台通用实现要点(桥接插件)

1. **入站消息统一建模**:飞书(open_id/chat_id + content JSON 字符串)、企微(UserID + XML)、Telegram(chat.id + text),桥接层先归一化为统一 Message 结构(platform、roomId、senderId、text、messageId、timestamp)。
2. **出站适配**:飞书 content 必须 JSON.stringify 后作为字符串;企微 text.content ≤2048 字节;Telegram ≤4096 字符分片 + parse_mode 转义。
3. **幂等**:飞书用 `message_id`(官方建议,不依赖 event_id);企微用 MsgId;Telegram 用 update_id(持久化 offset)。
4. **凭证管理**:飞书 tenant_access_token(2h)、企微 access_token(2h)都要缓存+提前刷新+锁;Telegram token 长期有效但泄露即失守。
5. **接收方式互斥**:飞书长连接与 Webhook 二选一;Telegram getUpdates 与 webhook 互斥;企微回调无替代。
6. **可靠性**:所有出站 API 失败需重试(企微 42001/45009、Telegram 429 按 retry_after);入站处理失败按各平台语义(企微 5s 重试 3 次、Telegram 不推进 offset、飞书长连接重连)。
