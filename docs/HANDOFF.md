# dsh-im-hub — GUI 设置卡片 Handoff（给 Codex）

> 交接人:DeepSeek Harness agent 会话
> 交接时间:2026-08-15
> 任务:让 dsh-im-hub 插件在 DSH Web GUI 的设置页出现**图形化可视化配置卡片**

---

## 1. 项目背景

`dsh-im-hub` 是一个 DSH(Cordis 插件框架)的 **bundle 插件**:把 dsh agent 接入 IM 平台(飞书/Lark 企业微信/Telegram/mock),支持每聊天一个 agent 会话、白名单、长回复分片。

- **仓库**:`D:\projects\dsh-im-hub`(本地 git,main 分支,已推到 GitHub `ThreeBody6666/dsh-im-hub`)
- **npm**:`dsh-im-hub@0.1.0` 已发布;**0.2.0(GUI 卡片版)未发布**(还在本地)
- **测试 profile**:`C:\Users\Lenovo\.dsh\profiles\im`(headless,已配 mock)
- **web profile**(运行中的 GUI):`C:\Users\Lenovo\.dsh\profiles\web`,`dsh-im-hub` 以 **link: junction** 指向 `D:\projects\dsh-im-hub`

## 2. 任务目标(用户原话)

> "不应该是这个界面有设置吗,你改一下,改成图形可视化的"
> 用户截图(桌面 `847d7e723fd39b8accc75b7699895478.png`,2559x1599,深色 UI)确认是 **DSH Web GUI 的设置页**。期望 dsh-im-hub 在那里有图形化配置表单。

## 3. 已完成的工作(全部本地验证通过)

### 3.1 host 端(`lib/index.js`,已改)
- 新增 `SETTINGS_NAMESPACE = settingsNamespace('im-hub')`
- 新增**扁平 settings schema**(`flatSchema`,27 个字段:enabled/telegram*/feishu*/lark*/wecom*/mock*/agent*/http*)
- 新增 `flatten(config)`(嵌套→扁平)与 `unflatten(flat, entry)`(扁平→嵌套,非暴露字段保留 entry 值)
- `apply()` 用 `installSettingsSection(ctx, SETTINGS_NAMESPACE, flatSchema, flatten(entry), {...})` 注册,**保存即热重载 Bridge**(onChange → stop 旧 bridge → start 新 bridge)
- secret 字段标 `.role('secret')`(telegramToken/feishuAppSecret/larkAppSecret/wecomCorpSecret/wecomToken/wecomEncodingAesKey)
- Config 加了顶层 `enabled` 总开关

### 3.2 client 端(`lib/client.js`,新文件,已写)
- **手写 ModuleLoader 模块**(`window.__ModuleLoader__.load({id, factory})`),无构建步骤
- 参照 `@linxin666/dsh-client-ui-task-board`(可工作范例)复刻:
  - `PluginSettingsCard`(折叠卡片 chrome,`state.available` 为 false 时**返回 null**)
  - `ValueField` / `BooleanField` / `SecretField`(凭据只显示"已配置/未设置"徽标,不留空=不改)
  - `CardForm`(staged 编辑 → save 时 `scope.set/unset`,secret 特殊处理)
  - 字段分组:General/Telegram/Feishu/Lark/WeCom/Mock/Agent/HTTP
  - 双语 locale(en/zh)
- `apply(ctx)`:注册 locale + `ctx.settingsScope.bind({namespace:'im-hub'})` + `ctx.slots.inject("settings.plugin.item", ...)` 注册卡片
- inject: `["slots", "settingsScope", "locale"]`

### 3.3 package.json(已改)
- version 0.2.0
- exports 加 `"./client"` → `./lib/client.js`
- `dsh.client` 声明:`{ inject: ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-settings"], platform: "web" }`
- peerDeps 加 `@deepseek-ai/dsh-settings`、`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-settings`

### 3.4 已验证的事实(重要!)
1. `flatten`/`unflatten` 往返正确(单元测试全过:27 字段、secret 往返、非暴露字段保留、id 列表转换)
2. **host 端 boot 成功**:headless boot web profile,mock 适配器端到端工作(`7*8=56`)
3. **client 在 boot graph 注册成功**:headless boot 探测 `clientModules.table.has('dsh-im-hub') === true`;运行中的 GUI(重启后 PID 15516)`__DSH_BOOT__.entries` 含 `dsh-im-hub`,`/plugins/dsh-im-hub/client.js` HTTP 200(34945 字节,含 ModuleLoader/imHubSettingsCard/settings.plugin.item)
4. **host settings namespace 已注册**:headless boot 探测 `settings.registrations` keys 含 `'im-hub'`(与 task-board 并列)
5. **热重载不生效**:touch `profiles/web/cordis.patch.yml` 后 `__DSH_BOOT__.rev` 不变——**dsh 只在启动时读 bundle 配置**,改 bundle 必须重启进程
6. 重启 dsh web 的方法:桌面 `restart-dsh-web.ps1`(安全脚本,解析原命令行重新启动)

## 4. 卡点:卡片没在设置页显示(需 Codex 解决)

**症状**:host 端一切正常(namespace 注册、Bridge 运行、client bundle 被服务),但用户说设置页里**没看到图形化设置**。

**可能的根因(未验证,按可疑度排序)**:
1. **设置页入口/Tab 位置**:卡片注册在 `settings.plugin.item` 插槽(官方"可配置插件"Tab,`dsh-client-ui-settings-plugins` 渲染)。用户可能看的是**"插件清单"Tab**(`dsh-client-ui-settings-plugin-inventory`,只读)或别的入口。**需要确认用户截图里到底打开的是哪个 Tab**。
2. **`state.available` 为 false**:`PluginSettingsCard` 在 `!state.available` 时返回 null。available = `snapshot.status === "ready"`。settingsScope 的 status 依赖 client 连接 host 的 settings RPC——**需要确认浏览器端能拿到 `{status:'ready'}` 的快照**。
3. **slot 注册时机/scope**:官方可配置 Tab 的 `settings.plugin.item` 是 `{kind:'list', scope:'root'}`。我们的卡片 inject 的 scope 是否匹配需要验证。
4. **client.js 运行时错误**:ModuleLoader 手写模块若有运行时错(如某 API 名不对),apply 会在浏览器 console 报错,卡片静默不出现。

**推荐调试路径**(Codex 可直接用):
```bash
# 1. 无头验证 client bundle 语法(ModuleLoader 闭包内无法 node --check,需浏览器)
# 2. 在浏览器 DevTools console 查:
#    - window.__DSH_BOOT__.entries 里 dsh-im-hub 是否加载
#    - 是否报错(client.js 的 require 或 apply)
#    - settingsScope 快照状态
# 3. 打开 设置 → 插件,看"可配置插件"Tab 是否列出卡片
# 4. 对照 task-board 的设置卡片(take: task-board 注册在 "web-ui.plugin.item",我们注册在 "settings.plugin.item")
```

## 5. 关键技术文档(DSH 机制,已逆向确认)

### 5.1 client bundle 加载机制
- 包 `package.json` 声明 `dsh.client`(`{inject:[...], platform:'web'}`)+ `exports["./client"]`
- host 端 `@deepseek-ai/dsh-client-modules`(`lib/index.js`)扫描 loader entries:
  - `processOne`:要求 `entry.options.name === entryName && entry.fiber !== void 0 && !entry.disabled`
  - `resolveMeta`: `require.resolve(spec/package.json)`(createRequire(baseUrl))→ 读 `dsh.client` → `clientExportOf` 解析 `exports["./client"]`
  - 服务 `/plugins/<id>/client.js`,注入 `window.__DSH_BOOT__` graph 到 index.html
- **bundle 行 id 必须 = 包名**(`cordis.patch.yml` 里 `- insert: [{id: 'dsh-im-hub', name: 'dsh-im-hub', disabled: true}]`)——早期用 `id: im-hub` 时 client 不被发现,改回包名后被发现

### 5.2 settings 服务(dsh-settings)
- `installSettingsSection(ctx, ns, schema, entry, hooks)`:注册 namespace,base=entry,`setSource(read)` 提供读 resolved 值的 thunk,`onChange` 在值变化时触发
- host `scope.get()` 返回**未 redact** 的真实值(secret 可用)
- client `settingsScope`(来自 `@deepseek-ai/dsh-client-ui-settings`)`bind({namespace})` → `getSnapshot()` 返回 `{status:'ready'|'unavailable', value, base, user, writable, secrets, revision}`;`set(field,value)` / `unset(field)` 写单字段
- **secret redact**:schema 字段 `.role('secret')`,client 快照里值被剥离,`secrets` 数组带 `{path:[field], set:boolean}` 指示是否已配置

### 5.3 官方可工作范例
- `@linxin666/dsh-client-ui-task-board`(`profiles/web/node_modules` 下,已装):完整可工作的 client bundle + settings 卡片,它的 `lib/client.js` 是**最佳参考模板**(CardForm/PluginSettingsCard/字段组件/CSS 注入全在里面,约 2500 行)
- 官方 `@deepseek-ai/dsh-client-ui-settings-plugins`:`lib/client.js` 里 3 张硬编码卡片(bash/agent-loop/web-search)走 `settings.plugin.item`(可配置 Tab)与 `ValueField/SecretField` 控件参考

## 6. 环境备忘

- node:`C:\nvm4w\nodejs\node.exe`(v22 系统)/ v24(Start-Process 用)
- dsh 安装:`C:\Users\Lenovo\AppData\Roaming\QClaw\npm-global\node_modules\@deepseek-ai\dsh`
- 运行中 GUI:PID 15516,`node bin.js web --port 3082`,父进程=隐藏 PowerShell(QClaw 启动,设了 DEEPSEEK_API_KEY)
- **不要杀 GUI 进程**(用户明确要求"别自己杀自己");重启用桌面 `restart-dsh-web.ps1`
- 项目根 `node_modules/@deepseek-ai/` 有 junction 到 dsh 全局(cordis/dsh-settings/dsh-client-runtime/dsh-client-ui-settings 等)
- 测试脚本:`test/probe-boot.mjs`(查 clientModules table)、`test/probe-settings.mjs`(查 settings namespace)、`test/v2-mock.overlay.yml`(headless boot 用,mock 端口 9192)
- headless boot 命令:`node <dsh>/lib/bin.js --profile web --patch test/v2-mock.overlay.yml`

## 7. 下一步建议(Codex)

1. **确认用户截图对应哪个设置 Tab**(让用户重截或描述;或 headless 渲染设置页截图)
2. **浏览器 DevTools 验证** client.js 是否加载、是否报错、settingsScope 快照 status
3. 若卡片在"可配置插件"Tab 已出现但用户没找到 → 引导用户;若真没渲染 → 查 available/scope/slot
4. 修好后:**发布 npm 0.2.0**(npm 账号 crazy_th,~/.npmrc 有 token)、推 GitHub、更新 README 截图
5. 记得:**revoke 对话中出现的 GitHub PAT 和 npm token**(安全)

## 8. 相关文件清单

| 文件 | 说明 |
|---|---|
| `D:\projects\dsh-im-hub\lib\index.js` | host 端(settings 集成已改) |
| `D:\projects\dsh-im-hub\lib\client.js` | client 端卡片(新,待验证) |
| `D:\projects\dsh-im-hub\package.json` | 0.2.0,dsh.client 声明 |
| `D:\projects\dsh-im-hub\cordis.patch.yml` | bundle 行 id=dsh-im-hub |
| `D:\projects\dsh-im-hub\test\probe-boot.mjs` | 探测 clientModules table |
| `D:\projects\dsh-im-hub\test\probe-settings.mjs` | 探测 settings namespace |
| `C:\Users\Lenovo\.dsh\profiles\web\cordis.patch.yml` | web profile 启用配置(mock 9099) |
| `C:\Users\Lenovo\Desktop\restart-dsh-web.ps1` | 安全重启脚本 |
| `C:\Users\Lenovo\Desktop\847d7e723fd39b8accc75b7699895478.png` | 用户截图(设置页) |
| 参考:`profiles\web\node_modules\@linxin666\dsh-client-ui-task-board\lib\client.js` | 最佳范例 |
| 参考:`profiles\node_modules\@deepseek-ai\dsh-client-modules\lib\index.js` | client 发现机制 |
| 参考:`profiles\node_modules\@deepseek-ai\dsh-settings\lib\index.js` | settings 服务 |
