# 企业微信(WeCom)应用消息回调协议笔记

> 用途:为 IM 桥接插件编写精确协议文档。
> 依据:企业微信官方开发文档(developer.work.weixin.qq.com)+ 官方加解密示例库 WXBizMsgCrypt + 开源实现(wechatpy 等)。
> 标注说明:文中所有信息均以官方文档为准;**带「待验证」标记的内容**为社区/经验确认、但本环境无法直接打开官方页面逐字核对的部分,落地前请以官方文档页面为准。

---

## 0. 关键官方文档索引

| 主题 | 官方文档 URL |
|---|---|
| 获取 access_token | https://developer.work.weixin.qq.com/document/path/91039 |
| 发送应用消息 | https://developer.work.weixin.qq.com/document/path/90236 |
| 应用推送消息(消息类型汇总) | https://developer.work.weixin.qq.com/document/path/90248 |
| 接收消息与事件 · 概述 | https://developer.work.weixin.qq.com/document/path/90238 |
| 消息格式(明文 XML 字段) | https://developer.work.weixin.qq.com/document/path/90239 |
| 事件格式(明文 XML 字段) | https://developer.work.weixin.qq.com/document/path/90240 |
| 支持被动回复的事件类型 | https://developer.work.weixin.qq.com/document/path/90241 |
| 被动回复消息 | https://developer.work.weixin.qq.com/document/path/101031 |
| 回调和回复的加解密方案 | https://developer.work.weixin.qq.com/document/path/101033 |
| 加解密方案说明 | https://developer.work.weixin.qq.com/document/path/96211 |
| 加解密库下载与返回码 | https://developer.work.weixin.qq.com/document/path/90307 |
| 全局错误码 | https://developer.work.weixin.qq.com/document/path/90455 |
| 获取企业微信域名 IP 信息 | https://developer.work.weixin.qq.com/document/path/100079 |
| 回调配置(客户联系等) | https://developer.work.weixin.qq.com/document/path/91116 |
| 回调协议相关(智能机器人 API 模式) | https://developer.work.weixin.qq.com/document/path/96062 |
| 代开发授权应用 access_token | https://developer.work.weixin.qq.com/document/path/97164 |

官方示例代码仓库(含 WXBizMsgCrypt.py / Sample.py):
- https://github.com/sbzhu/weworkapi_python (企业微信官方 Python 加解密示例)
- https://github.com/wechatpy/wechatpy (Python SDK,`wechatpy.crypto.WeChatCrypto` 即 WXBizMsgCrypt 的移植,文档 https://docs.wechatpy.org)

基础事实:
- 所有企业微信 API 响应均为 **UTF-8** 编码。
- 服务器域名:`qyapi.weixin.qq.com`(调用方出网)、`developer.work.weixin.qq.com`(文档)。
- 企业微信服务器回调来源 IP 是固定的,可在「获取企业微信域名 IP 信息」文档(path/100079)查询,防火墙需放行。

---

## 1. 获取 access_token

### 1.1 请求

```
GET https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=ID&corpsecret=SECRET
```

| 参数 | 必填 | 说明 |
|---|---|---|
| corpid | 是 | 企业 ID(每个企业唯一;登录管理后台「我的企业」可查) |
| corpsecret | 是 | 应用的凭证密钥(应用 Secret;在「应用管理 → 自建应用 → 应用详情 → Secret」查看/重置) |

> 注意:企业微信的 corpid 是普通字符串(如 `ww1234567890abcdef`),与微信开放平台的 appid 不同;自建应用调用时用的是**应用自己的 secret**,不是通讯录同步的 secret。企业微信没有单独获取 corpid 的 API,需要管理员从管理后台复制。

### 1.2 响应(JSON)

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
| errcode | 返回码,0 表示成功 |
| errmsg | 返回码的文本描述 |
| access_token | 凭证,最长为 512 字节(待验证:官方文档原文为「最长为512字节」) |
| expires_in | 凭证有效时间(秒),正常为 7200(2 小时) |

### 1.3 curl / fetch 示例

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
const data = await res.json(); // {errcode, errmsg, access_token, expires_in}
```

### 1.4 有效期与缓存建议

- 有效期由返回的 `expires_in` 决定,正常情况下 7200 秒(2 小时)。
- **有效期内重复获取返回相同结果;过期后获取返回新的 access_token。**
- 官方建议:**开发者需要缓存 access_token,用于后续接口的调用**;每个应用的 access_token 彼此独立,需各自缓存。
- 实践建议:内存缓存 + 提前 5~10 分钟过期刷新;多实例部署时可用 Redis + 分布式锁防止 gettoken 并发风暴;收到 `42001`(access_token 过期)时刷新后重试一次。
- 注意:若企业管理后台配置了「企业可信 IP」,则调用接口(含 gettoken)的出口 IP 必须在白名单内,否则报 `60020 访问ip不在白名单之中`。

### 1.5 常见错误码(gettoken)

| errcode | 含义 |
|---|---|
| 0 | 成功 |
| 40001 | 不合法的 secret(应用 Secret 错误 / 应用未启用) |
| 40013 | 不合法的 corpid |
| 42001 | access_token 过期(更多用于后续接口) |
| 60020 | 访问 IP 不在白名单之中(配置了可信 IP 时) |

(错误码全集见全局错误码文档 path/90455)

---

## 2. 主动发送应用消息

### 2.1 请求

```
POST https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=ACCESS_TOKEN
Content-Type: application/json; charset=utf-8
```

### 2.2 请求体字段(text 消息)

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
  "safe": 0,
  "enable_id_trans": 0,
  "enable_duplicate_check": 0,
  "duplicate_check_interval": 1800
}
```

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| touser | 二选一(与 toparty/totag 至少一个非空) | string | 成员 ID 列表,多个用 `\|` 分隔,**最多支持 1000 个**(待验证精确上限);特殊值 `@all` 表示向该应用全部成员发送(需应用有发送权限)。当 touser=@all 时忽略 toparty/totag |
| toparty | 同上 | string | 部门 ID 列表,多个用 `\|` 分隔,最多 100 个(待验证) |
| totag | 同上 | string | 标签 ID 列表,多个用 `\|` 分隔,最多 100 个(待验证) |
| msgtype | 是 | string | 消息类型:text / image / voice / video / file / textcard / news / mpnews / markdown / miniprogram_notice / template_card / interact_task_card(完整列表见「应用推送消息」path/90248) |
| agentid | 是 | int | 企业应用 id,在应用设置页面查看 |
| text.content | 是(msgtype=text) | string | 消息内容,**最长不超过 2048 字节(UTF-8)**,超长会被截断;支持换行 `\n`;支持 `<a href="...">` 超链接标签(待验证:是否支持富文本标签的精确规则) |
| safe | 否 | int | 是否保密消息:0 否(默认)、1 是(保密消息不能转发/复制等) |
| enable_id_trans | 否 | int | 是否开启 id 转译:0 否(默认)、1 是(一般仅第三方应用需要) |
| enable_duplicate_check | 否 | int | 是否开启重复消息检查:0 否(默认)、1 是 |
| duplicate_check_interval | 否 | int | 重复消息检查的时间间隔,默认 1800 秒,最大不超过 4 小时(待验证) |

> 消息内容(明文或含链接的 content)需注意:content 不能携带 HTML 标签以外的富文本,官方对 text 的说明是「消息内容,最长不超过2048个字节,支持换行、以及A标签」,具体富文本能力以文档为准。

### 2.3 curl / fetch 示例

```bash
curl -X POST "https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"touser":"zhangsan|lisi","msgtype":"text","agentid":1000002,"text":{"content":"hello"}}'
```

```js
// Node.js fetch
const res = await fetch(
  "https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=" + accessToken,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      touser: "@all",
      msgtype: "text",
      agentid: 1000002,
      text: { content: "hello from bridge" },
      safe: 0,
    }),
  }
);
const data = await res.json();
```

### 2.4 响应(JSON)

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
| errcode | 0 表示成功 |
| errmsg | ok 或错误描述 |
| invaliduser | 不合法的 userid(不区分大小写,统一转为小写返回) |
| invalidparty | 不合法的 partyid |
| invalidtag | 不合法的 tagid |

> 注意:接口返回 errcode=0 只代表「受理成功」,不代表用户一定收到;`invaliduser` 等字段会列出投递失败的目标。用户未收到消息的常见原因:用户不在应用可见范围、用户未安装/未使用企业微信、频率限制、内容被安全策略拦截等。

### 2.5 频率限制与常见错误

- 发送应用消息有频率限制:**每个应用每分钟最多发送 30 次**(社区官方答复确认「超过30次/分钟会触发限制」;精确条款见 path/90236 文档正文,标注待验证);另有按用户的接收上限(待验证)。
- 常见错误码:

| errcode | 含义 |
|---|---|
| 0 | ok |
| 40014 | 不合法的 access_token |
| 42001 | access_token 过期 |
| 45009 | 接口调用超过限制(消息发送频率超限) |
| 60011 | 没有权限发送消息给该用户(用户不在应用可见范围等) |
| 60020 | 访问 IP 不在白名单之中 |

---

## 3. 接收回调(应用消息回调)

### 3.0 概览

- 企业微信服务器向回调 URL 发起两种请求:
  - **GET**:URL 验证(配置回调时触发)。
  - **POST**:消息/事件推送(body 为加密 XML)。
- 自建应用「接收消息」模式下,**上行(推送)与下行(被动回复)均为加密传输**,必须实现 WXBizMsgCrypt 全套(验签 + AES 解密 + AES 加密 + 签名)。

### 3.1 URL 验证流程(GET)

企业微信服务器向回调 URL 发送 GET 请求,query 参数:

| 参数 | 说明 |
|---|---|
| msg_signature | 签名,用于校验请求合法性 |
| timestamp | 时间戳 |
| nonce | 随机串 |
| echostr | 加密的随机字符串(明文为一段随机字符串,用于验证) |

验证步骤(与官方 WXBizMsgCrypt.VerifyURL 一致):

1. **验签**:对 `[token, timestamp, nonce, echostr]` 四个字符串**按字典序升序排序**后拼接成一个字符串,做 **SHA1**,结果 hex 编码,与参数 `msg_signature` 比对;一致才继续,否则直接失败(返回空/错误)。
2. **解密**:将 `echostr`(Base64 密文)按 3.2 的 AES 解密流程解密,得到 `16字节随机串 + 4字节长度 + echostr原文 + corpid`,取出中间的 **echostr 原文**。
3. **响应**:把解密出的 echostr 原文**原样作为 HTTP 响应体返回**(纯文本;**不能加引号、不能带 BOM、不能带换行符**,需在 1 秒内返回)。配置页面「保存」时若 1 秒内收不到正确响应,会提示「openapi 回调地址请求不通过」。

```js
// 验证 URL 的 GET handler 伪代码(Node)
async function onVerify(req, res) {
  const { msg_signature, timestamp, nonce, echostr } = req.query;
  // 1. 验签
  const expect = sha1([TOKEN, timestamp, nonce, echostr].sort().join(""));
  if (expect !== msg_signature) { res.status(403).end(); return; }
  // 2. 解密 echostr
  const plain = decrypt(echostr);            // AES-256-CBC 解密
  const msg = extractMessage(plain);         // 去掉16字节随机串+4字节长度,尾部corpid
  // 3. 原样返回解密后的 echostr 原文
  res.status(200).send(msg);                 // 不要加引号/换行/BOM
}
```

### 3.2 消息加解密算法(WXBizMsgCrypt)

官方加解密方案见 path/96211「加解密方案说明」与 path/101033「回调和回复的加解密方案」。

**密钥派生**

- 管理后台配置的 `EncodingAESKey` 是 **43 位**随机字符(大小写字母+数字)。
- 实际 AES 密钥:`AESKey = Base64_Decode(EncodingAESKey + "=")`,即先补一个 `=` 凑成 44 字符再做标准 Base64 解码,得到 **32 字节**密钥(对应 AES-256)。
- 加密算法:**AES-256-CBC**;**IV = AESKey 前 16 字节**。

**加密方向(发送/被动回复时构造密文)**

明文结构(拼接):

```
明文 = random(16字节) + msg_len(4字节,网络字节序/大端) + 消息明文(XML) + receiveid(企业的corpid)
```

1. 生成 16 字节随机串(每个消息不同)。
2. 计算消息明文(XML 字符串)的字节长度,按**网络字节序(大端)**写入 4 字节。
3. 拼接 receiveid(即企业的 corpid,用于接收方校验)。
4. 对上述整体做 **PKCS#7 填充**(注意:块大小为 **32 字节**,不是标准 AES 的 16 字节)。
5. AES-256-CBC 加密(密钥 32 字节,IV=密钥前 16 字节)。
6. **Base64 编码**,得到 `msg_encrypt`。

**解密方向(接收推送/验证 echostr 时)**

```
步骤:
1. Base64 解码 msg_encrypt/echostr → 密文字节
2. AES-256-CBC 解密(密钥 32 字节,IV=密钥前16字节) → 带填充的明文
3. 去掉 PKCS#7 填充(校验填充合法)
4. 解析:前 16 字节随机串(丢弃);接着 4 字节大端长度 N;再取 N 字节为消息明文;
   剩余部分为 receiveid,必须与企业的 corpid 一致(不一致 = 密钥/参数配错,解密失败)
```

**PKCS#7 填充细节**

- 填充值为 `pad = 32 - (len % 32)`,每个填充字节的值都等于 `pad`(1..32)。
- 去填充时校验最后 1 字节的值 `p` 在 1..32,且末尾 p 个字节全部等于 p,否则判非法。

**签名算法(sha1)**

```
msg_signature = sha1_hex( sort([token, timestamp, nonce, msg_encrypt]).join("") )
```

- 对 `[token, timestamp, nonce, msg_encrypt]`(或验证 URL 时用 `echostr` 代替 `msg_encrypt`)按**字典序升序排序**,拼接成单个字符串,做 SHA1,输出 40 位小写 hex。
- 比对时用 `==`(大小写敏感,官方示例为小写 hex;待验证:官方对大小写是否严格)。

**算法伪代码(完整)**

```python
import base64, hashlib, struct, os
from Crypto.Cipher import AES

def get_aes_key(encoding_aes_key: str) -> bytes:
    # 43 位 EncodingAESKey + "=" -> Base64 解码 -> 32 字节
    return base64.b64decode(encoding_aes_key + "=")

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
    cipher = AES.new(key, AES.MODE_CBC, key[:16])   # IV = 密钥前16字节
    return base64.b64encode(cipher.encrypt(pkcs7_pad(raw, 32))).decode()

def decrypt_msg(msg_encrypt: str, encoding_aes_key: str, corpid: str) -> str:
    key = get_aes_key(encoding_aes_key)
    cipher = AES.new(key, AES.MODE_CBC, key[:16])
    raw = pkcs7_unpad(cipher.decrypt(base64.b64decode(msg_encrypt)), 32)
    # 结构: random(16) + len(4,大端) + xml + receiveid
    msg_len = struct.unpack(">I", raw[16:20])[0]
    xml = raw[20:20 + msg_len].decode("utf-8")
    receiveid = raw[20 + msg_len:].decode("utf-8")
    if receiveid != corpid:
        raise ValueError("receiveid mismatch (corpid)")
    return xml

def get_signature(token: str, timestamp: str, nonce: str, msg_encrypt: str) -> str:
    s = "".join(sorted([token, timestamp, nonce, msg_encrypt]))
    return hashlib.sha1(s.encode("utf-8")).hexdigest()
```

> 对应实现参考:官方 Python 示例 `WXBizMsgCrypt.py`(sbzhu/weworkapi_python)、wechatpy 的 `wechatpy/crypto/__init__.py`(WeChatCrypto)。Rust 侧可参考 `wechat-vendor-sdk` 等开源 crate;Node 侧可参考 `@wecom/crypto` 或自实现(注意 Node `crypto` 的 `setAutoPadding(false)` 手动做 32 字节 PKCS#7)。

### 3.3 POST 消息体 XML 结构(推送)

企业微信 → 服务器(POST),body 为 XML:

```xml
<xml>
   <ToUserName><![CDATA[toUser]]></ToUserName>
   <AgentID><![CDATA[toAgentID]]></AgentID>
   <Encrypt><![CDATA[msg_encrypt]]></Encrypt>
</xml>
```

| 字段 | 说明 |
|---|---|
| ToUserName | 企业的 corpid |
| AgentID | 应用的 AgentID(部分文档示例用 CDATA 包裹,内容为数字字符串) |
| Encrypt | Base64 密文(由 3.2 解密得到明文 XML) |

处理流程:验签(`sort([token, timestamp, nonce, Encrypt值])` → sha1 → 与 query 参数 `msg_signature` 比对)→ 用 `Encrypt` 值 AES 解密 → 校验 receiveid == corpid → 解析明文 XML。

**明文 XML(text 消息)结构**:

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
| MsgType | 消息类型,text(其他类型见 path/90239「消息格式」) |
| Content | 文本内容(UTF-8) |
| MsgId | 消息 id,可用于去重(重试推送时 MsgId 不变) |
| AgentID | 应用 id |

### 3.4 POST 之后回什么

- **不需要被动回复**时:返回**空串**(HTTP 200 空 body)即可;也有实现返回 `success`(社区讨论「服务器未正确返回响应字符串 success」提示部分场景需要返回 success;官方文档示例为不回复返回空,标注**待验证**,建议默认返回空串 200,若日志提示需 success 再调整)。
- **需要被动回复**时:在 **5 秒内**返回加密后的回复 XML(见 3.5)。

### 3.5 被动回复(下行)

- 官方文档 path/101031「被动回复消息」:**必须在 5 秒内响应**,否则企业微信服务器会断开连接并重试,**总共重试三次**(第一次发送 + 两次重试;重试间隔不定,一般在几十秒级别,待验证)。
- 回复体必须为**加密 XML**:

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
| Encrypt | 用 3.2 加密算法对「明文回复 XML」加密后的 Base64 |
| MsgSignature | `sha1( sort([token, timestamp, nonce, msg_encrypt]).join("") )` |
| TimeStamp | 时间戳(自己生成) |
| Nonce | 随机串(自己生成) |

- 明文回复 XML(text 消息):

```xml
<xml>
   <ToUserName><![CDATA[toUser]]></ToUserName>
   <FromUserName><![CDATA[fromUser]]></FromUserName>
   <CreateTime>1348831860</CreateTime>
   <MsgType><![CDATA[text]]></MsgType>
   <Content><![CDATA[this is a test]]></Content>
</xml>
```

> 待验证:被动回复明文 XML 中 `ToUserName` 为接收方成员 UserID、`FromUserName` 为发送方标识(通常为企业 corpid);部分文档示例未包含 `AgentID` 字段。落地前对照 path/101031 与 path/101033 核对。

### 3.6 重试与幂等

- 5 秒内未响应/响应异常 → 企业微信服务器重发,总计**重试三次**。
- 去重建议:有 `MsgId` 的消息用 `MsgId` 去重;事件类消息(无 MsgId)用 `FromUserName + CreateTime` 去重(官方 path/90238 概述建议)。

---

## 4. 后台配置(管理后台「接收消息」)

### 4.1 配置位置与步骤(自建应用)

1. 登录企业微信管理后台:https://work.weixin.qq.com/wework_admin/frame
2. 左侧「**应用管理**」→「**自建**」→ 选择(或新建)目标应用,进入「**应用详情**」。
3. 找到「**接收消息**」区块 → 点击「**设置API接收**」(部分版本为「开启接收消息」)。
4. 填写三项:
   - **URL**:你的回调地址(公网可访问,同时处理 GET 验证与 POST 消息)。
   - **Token**:自定义随机字符串,参与签名计算。
   - **EncodingAESKey**:43 位随机字符;页面提供「**随机生成**」按钮。
5. 点击「**保存**」,企业微信服务器会立即向 URL 发 GET 验证请求;验证通过后保存成功,否则提示「openapi 回调地址请求不通过」。
6. (可选)在该区块可以配置需要接收的**事件**(如进入应用、菜单点击等,见 path/90240「事件格式」)。

> 第三方应用/代开发应用的「接收消息」配置在服务商后台,URL 验证协议与自建应用一致(见 path/91116、path/96062)。

### 4.2 URL 要求

- **必须是公网可访问的 HTTP/HTTPS 地址**(内网/局域网地址不可用;开发调试可用内网穿透)。
- 必须**同时支持 GET(URL 验证)与 POST(消息推送)**两个 method,且 GET 验证需在 **1 秒内**返回解密后的 echostr 原文。
- 建议配置 HTTPS(生产环境);端口不限(默认 80/443 亦可)。
- 企业微信服务器回调来源 IP 固定,若服务器有防火墙,需放行企业微信回调 IP 段(见 path/100079「获取企业微信域名 IP 信息」)。

---

## 5. 实现时的坑(Checklist)

1. **回调 URL 必须公网可达**:保存配置时验证失败,90% 是 URL 不通(内网/未备案/防火墙)或 GET 处理逻辑错误。
2. **验证响应格式**:返回解密后的 echostr 原文,**不能加引号、不能带 BOM、不能带换行符**,且要在 **1 秒内**返回。
3. **msg_signature 验证失败的排查顺序**:
   - 后台 Token 与代码里用的 Token 是否一致;
   - 参与签名的字段:GET 验证用 `echostr`,POST 用 `Encrypt` 值(是密文本身,不是解密后的明文);
   - 排序是 `sort([token, timestamp, nonce, msg_encrypt])` 后直接 `join`(中间**没有分隔符**);
   - query 参数名大小写:`msg_signature` / `timestamp` / `nonce` / `echostr`;
   - 若自己拼 URL 转发,注意参数 URL 编码(base64 含 `+` `/` `=`,解码后再参与计算)。
4. **EncodingAESKey 的 base64 处理**:43 位字符串**不能直接当密钥**,必须先 `Base64_Decode(EncodingAESKey + "=")` 得到 32 字节;IV 取这 32 字节的**前 16 字节**。
5. **PKCS#7 块大小是 32**,不是 16;解密后必须校验 padding 合法性与尾部 `receiveid == corpid`(常见报错 40001/解密失败)。
6. **XML 解析防 XXE**:不要用 `document.loadXML` / 未禁用外部实体的解析器;禁用 DOCTYPE/外部实体(`libxml_disable_entity_loader`、Java `XMLConstants.FEATURE_SECURE_PROCESSING`、Python `defusedxml`、Node 用 `sax`/`fast-xml-parser` 的 `processEntities:false` 等)。
7. **被动回复 5 秒超时**:超时后企业微信重试,**总共 3 次**;回复内容必须是**加密 XML**(Encrypt/MsgSignature/TimeStamp/Nonce),不能回明文。
8. **消息幂等**:处理重试推送时用 `MsgId`(事件用 `FromUserName+CreateTime`)去重,避免重复入队/重复回复。
9. **access_token 缓存**:7200 秒有效期、每应用独立、过期自动刷新;收到 `42001` 时刷新重试;并发场景加锁防 gettoken 风暴。
10. **发送频率限制**:应用消息发送约 **30 次/分钟**(待验证精确值),超限返回 `45009`;大批量发送要限速/排队。
11. **touser 语义**:支持 `@all`(全部成员);多个目标用 `|` 分隔;`touser`/`toparty`/`totag` 不能同时为空;`content` 最长 **2048 字节**,超长截断。
12. **安全**:qyapi 一律走 HTTPS;回调接口建议同时校验来源 IP(可选);解析 Encrypt 前先验签,防止伪造推送。
13. **编码**:全部 UTF-8;中文 content 按字节计数,截断按 UTF-8 边界处理。
14. **加解密库错误码**(path/90307,与公众号 WXBizMsgCrypt 同源,具体编号待验证):40001 签名错误 / 40002 xml解析失败 / 40003 sha生成签名失败 / 40004 AESKey非法 / 40005 corpid校验失败 / 40006 AES加密失败 / 40007 AES解密失败 / 40008 解密后buffer非法 / 40009 base64加密失败 / 40010 base64解密失败 / 40011 生成xml失败。

---

## 6. 消息/事件明文格式速查(见 path/90239、path/90240)

- 文本消息(text):ToUserName / FromUserName / CreateTime / MsgType=text / Content / MsgId / AgentID
- 图片(image):MsgType=image / PicUrl / MediaId
- 语音(voice):MsgType=voice / MediaId / Format
- 视频(video):MsgType=video / MediaId / ThumbMediaId
- 位置(location):MsgType=location / Lat / Lon / Scale / Label
- 链接(link):MsgType=link / Title / Description / Url
- 事件(event):MsgType=event / Event(subscribe/click/location_select 等)/ EventKey

(各字段精确说明与全部类型以 path/90239、path/90240 为准)

---

## 附:参考来源汇总

**官方文档**
- 获取 access_token:https://developer.work.weixin.qq.com/document/path/91039
- 发送应用消息:https://developer.work.weixin.qq.com/document/path/90236
- 应用推送消息:https://developer.work.weixin.qq.com/document/path/90248
- 接收消息与事件概述:https://developer.work.weixin.qq.com/document/path/90238
- 消息格式:https://developer.work.weixin.qq.com/document/path/90239
- 事件格式:https://developer.work.weixin.qq.com/document/path/90240
- 被动回复消息:https://developer.work.weixin.qq.com/document/path/101031
- 回调和回复的加解密方案:https://developer.work.weixin.qq.com/document/path/101033
- 加解密方案说明:https://developer.work.weixin.qq.com/document/path/96211
- 加解密库下载与返回码:https://developer.work.weixin.qq.com/document/path/90307
- 全局错误码:https://developer.work.weixin.qq.com/document/path/90455
- 获取企业微信域名 IP 信息:https://developer.work.weixin.qq.com/document/path/100079
- 回调配置:https://developer.work.weixin.qq.com/document/path/91116
- 回调协议相关:https://developer.work.weixin.qq.com/document/path/96062
- 代开发授权应用 access_token:https://developer.work.weixin.qq.com/document/path/97164

**社区/官方答复(用于交叉验证)**
- 「在1秒内原样返回明文消息内容(不能加引号,不能带bom头,不能带换行符)」:https://developer.work.weixin.qq.com/community/question/detail?content_id=16453007251671094233
- 「回调服务器重复三次后,不再重试」:https://developer.work.weixin.qq.com/community/question/detail?content_id=16699307466505119319
- 「发送应用消息频率超过30次/分钟限制」:https://developer.work.weixin.qq.com/community/question/detail?content_id=16340056285144991231
- 「接收应用消息超过2048字节会被截断」:https://developer.work.weixin.qq.com/community/question/detail?content_id=16540826132934631330
- 「服务器未正确返回响应字符串success」:https://developer.work.weixin.qq.com/community/question/detail?content_id=16607733400671565309
- 「使用AESKey=Base64_Decode(EncodingAESKey + "=")解密不出来」:https://developer.work.weixin.qq.com/community/question/detail?content_id=16698268536935408406

**开源实现**
- 官方示例代码:https://github.com/sbzhu/weworkapi_python
- wechatpy:https://github.com/wechatpy/wechatpy (https://docs.wechatpy.org)
- wdk-docs 文档镜像(加解密方案):https://wdk-docs.github.io/wework-docs/appendix/encryption-and-decryption/

**环境限制说明**:本环境的沙箱无法直连外网抓取官方页面原文,以上内容基于 web_search 检索到的官方文档 URL、官方示例代码与社区官方答复交叉确认;凡标注「待验证」的条目,建议在写代码前打开对应官方文档页面逐字核对。
