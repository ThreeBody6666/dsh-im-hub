// dsh-im-hub — turn a DeepSeek Harness (dsh) agent into an IM assistant.
//
// This is a dsh *bundle* plugin: package.json declares `dsh.bundle.patch` →
// ./cordis.patch.yml, which inserts the `im-hub` row into the profile's
// Cordis loader tree. When enabled (see the patch file), this plugin mounts
// one or more IM adapters (Feishu / Lark / WeCom / Telegram / mock), bridges
// inbound chat messages into dsh agents, and relays the agent's replies back
// to the chat.
//
// The driving pattern mirrors @deepseek-ai/dsh-headless: create an agent
// through the core registry (`ctx.agents`), followup a user message, wait for
// quiescence, and read the assistant text back from the session log. Unlike
// headless, the bridge keeps agents alive per chat so multi-turn conversations
// retain context, and it streams the session events to the IM side.
//
// Settings integration (web GUI card)
// -----------------------------------
// The plugin registers a `dsh-settings` namespace (`im-hub`) so the Web GUI's
// plugin-settings surface can edit the configuration visually instead of
// hand-editing `cordis.patch.yml`. Because the client settings API writes
// scalar fields only, the namespace uses a *flat* schema (`flatSchema`), and
// this host converts back and forth to the nested `Config` shape the Bridge
// consumes:
//
//   patch.yml entry (nested Config)  --flatten()-->  settings base (flat)
//   settings user layer (flat)       --unflatten()--> Bridge config (nested)
//
// The flat schema declares credential fields with `.role('secret')` so their
// values never ride the wire to the browser: the GUI shows a "configured"
// badge and a write-only input. The host side reads the resolved value
// through `ctx.settings` (unredacted), so real secrets still reach the Bridge.
//
// Hot reload: a settings change re-registers the source thunk and triggers
// `sync()`, which stops the current Bridge and starts a fresh one with the new
// effective config — no profile restart needed for GUI edits.

import z from '@deepseek-ai/schemastery';
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { Bridge } from './bridge.js';

/** Stable Cordis plugin name (row id in the bundle patch). */
export const name = 'dsh-im-hub';

/**
 * Core services the bridge needs before it can drive turns. `loader` is
 * awaited at start so the whole tree is mounted before the first message.
 */
export const inject = ['agentDefaultModel', 'agents', 'sessions', 'loader'];

/** Settings namespace this plugin owns (spelled here, mirrored in the browser half). */
export const SETTINGS_NAMESPACE = settingsNamespace('im-hub');

/** Configuration schema (validated by the Cordis loader). */
export const Config = z.object({
	/** Master switch: when false the whole IM gateway stays dormant. */
	enabled: z.boolean().default(true),
	adapters: z.object({
		telegram: z.object({
			enabled: z.boolean().default(false),
			/** Bot token from BotFather: `123456:ABC-DEF...` */
			token: z.string().role('secret').default(''),
			/** Numeric user ids allowed to talk to the bot; empty = everyone. */
			allowedUserIds: z.array(z.number()).default([]),
			/** getUpdates long-poll timeout, seconds. */
			timeoutSeconds: z.number().default(50),
			/** Poll gap after a timeout/error, ms. */
			pollIntervalMs: z.number().default(500)
		}).default({}),
		feishu: z.object({
			enabled: z.boolean().default(false),
			/** App id of a Feishu/Lark custom app with the message-receive event subscribed. */
			appId: z.string().default(''),
			appSecret: z.string().role('secret').default(''),
			/**
			 * `websocket` = official long connection (no public endpoint needed).
			 * `webhook` = HTTP callback (needs a public URL; server binds on
			 * http.host/http.port under config.webhookPath).
			 */
			mode: z.union(['websocket', 'webhook']).default('websocket'),
			webhookPath: z.string().default('/feishu'),
			/** Webhook challenge / event verification token. */
			verificationToken: z.string().default(''),
			/** Open ids allowed to talk to the bot; empty = everyone. */
			allowedUserIds: z.array(z.string()).default([])
		}).default({}),
		lark: z.object({
			/** International edition of the same open platform (open.larksuite.com). */
			enabled: z.boolean().default(false),
			/** App id of a Lark custom app with the message-receive event subscribed. */
			appId: z.string().default(''),
			appSecret: z.string().role('secret').default(''),
			/**
			 * `websocket` = official long connection (no public endpoint needed).
			 * `webhook` = HTTP callback (needs a public URL; server binds on
			 * http.host/http.port under config.webhookPath).
			 */
			mode: z.union(['websocket', 'webhook']).default('websocket'),
			webhookPath: z.string().default('/lark'),
			/** Webhook challenge / event verification token. */
			verificationToken: z.string().default(''),
			/** Open ids allowed to talk to the bot; empty = everyone. */
			allowedUserIds: z.array(z.string()).default([])
		}).default({}),
		wecom: z.object({
			enabled: z.boolean().default(false),
			/** Corp id (企业ID). */
			corpId: z.string().default(''),
			/** Secret of the app used to send messages (应用的Secret). */
			corpSecret: z.string().role('secret').default(''),
			/** Agent id of that app. */
			agentId: z.string().default(''),
			/** Callback Token configured in WeCom admin console (接收消息服务器配置). */
			token: z.string().role('secret').default(''),
			/** Callback EncodingAESKey (43 chars). */
			encodingAesKey: z.string().role('secret').default(''),
			/** HTTP path the callback server binds. */
			path: z.string().default('/wecom'),
			/** User ids allowed to talk to the bot; empty = everyone. */
			allowedUserIds: z.array(z.string()).default([])
		}).default({}),
		mock: z.object({
			/** Test-only adapter: reads stdin lines, prints replies to stdout. */
			enabled: z.boolean().default(false),
			/** Optional fixed HTTP port for the mock endpoint (0 = ephemeral). */
			port: z.number().default(0)
		}).default({})
	}),
	agent: z.object({
		/** Working directory for agent sessions (defaults to the dsh process cwd). */
		cwd: z.string().default(''),
		/** Override provider/model; empty = use the deployment default selection. */
		provider: z.string().default(''),
		model: z.string().default(''),
		/** Maximum chars per outbound message; longer replies are split. */
		maxMessageLength: z.number().default(4000),
		/** Idle ms before a chat's agent is disposed (memory reclamation). 0 = never. */
		idleTimeoutMs: z.number().default(30 * 60 * 1000),
		/** Prefix attached to every user message (optional instruction bias). */
		instructionPrefix: z.string().default('')
	}).default({}),
	http: z.object({
		/** Bind host for the webhook-mode HTTP server (feishu webhook / wecom callback). */
		host: z.string().default('0.0.0.0'),
		/** Bind port for the webhook-mode HTTP server. */
		port: z.number().default(8080)
	}).default({})
});

// ------------------------------------------------------------------ settings

/**
 * Flat settings schema exposed to the web GUI card. Mirrors the nested
 * `Config` shape one level deep; credential fields are `role('secret')`.
 * The browser half spells the same values without importing this file.
 */
export const flatSchema = z.object({
	enabled: z.boolean().default(true),
	// Telegram
	telegramEnabled: z.boolean().default(false),
	telegramToken: z.string().role('secret').default(''),
	telegramAllowedUserIds: z.string().default(''),
	// Feishu
	feishuEnabled: z.boolean().default(false),
	feishuAppId: z.string().default(''),
	feishuAppSecret: z.string().role('secret').default(''),
	feishuAllowedUserIds: z.string().default(''),
	// Lark (international)
	larkEnabled: z.boolean().default(false),
	larkAppId: z.string().default(''),
	larkAppSecret: z.string().role('secret').default(''),
	larkAllowedUserIds: z.string().default(''),
	// WeCom
	wecomEnabled: z.boolean().default(false),
	wecomCorpId: z.string().default(''),
	wecomCorpSecret: z.string().role('secret').default(''),
	wecomAgentId: z.string().default(''),
	wecomToken: z.string().role('secret').default(''),
	wecomEncodingAesKey: z.string().role('secret').default(''),
	wecomAllowedUserIds: z.string().default(''),
	// Mock (test only)
	mockEnabled: z.boolean().default(false),
	mockPort: z.number().default(0),
	// Agent
	agentCwd: z.string().default(''),
	agentProvider: z.string().default(''),
	agentModel: z.string().default(''),
	agentMaxMessageLength: z.number().default(4000),
	// HTTP (webhook mode)
	httpHost: z.string().default('0.0.0.0'),
	httpPort: z.number().default(8080)
});

/** Split a comma/space separated whitelist string into an array (or [] when empty). */
function splitIds(text) {
	return text.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean);
}

/** Convert the nested Bridge config into the flat settings shape. */
export function flatten(config) {
	return {
		enabled: config.enabled ?? true,
		telegramEnabled: config.adapters?.telegram?.enabled ?? false,
		telegramToken: config.adapters?.telegram?.token ?? '',
		telegramAllowedUserIds: (config.adapters?.telegram?.allowedUserIds ?? []).join(', '),
		feishuEnabled: config.adapters?.feishu?.enabled ?? false,
		feishuAppId: config.adapters?.feishu?.appId ?? '',
		feishuAppSecret: config.adapters?.feishu?.appSecret ?? '',
		feishuAllowedUserIds: (config.adapters?.feishu?.allowedUserIds ?? []).join(', '),
		larkEnabled: config.adapters?.lark?.enabled ?? false,
		larkAppId: config.adapters?.lark?.appId ?? '',
		larkAppSecret: config.adapters?.lark?.appSecret ?? '',
		larkAllowedUserIds: (config.adapters?.lark?.allowedUserIds ?? []).join(', '),
		wecomEnabled: config.adapters?.wecom?.enabled ?? false,
		wecomCorpId: config.adapters?.wecom?.corpId ?? '',
		wecomCorpSecret: config.adapters?.wecom?.corpSecret ?? '',
		wecomAgentId: config.adapters?.wecom?.agentId ?? '',
		wecomToken: config.adapters?.wecom?.token ?? '',
		wecomEncodingAesKey: config.adapters?.wecom?.encodingAesKey ?? '',
		wecomAllowedUserIds: (config.adapters?.wecom?.allowedUserIds ?? []).join(', '),
		mockEnabled: config.adapters?.mock?.enabled ?? false,
		mockPort: config.adapters?.mock?.port ?? 0,
		agentCwd: config.agent?.cwd ?? '',
		agentProvider: config.agent?.provider ?? '',
		agentModel: config.agent?.model ?? '',
		agentMaxMessageLength: config.agent?.maxMessageLength ?? 4000,
		httpHost: config.http?.host ?? '0.0.0.0',
		httpPort: config.http?.port ?? 8080
	};
}

/**
 * Convert the flat settings value into the nested Bridge config. Fields the
 * GUI does not expose (modes, polling tuning, idle timeout, …) keep the
 * `entry` values so GUI edits never clobber them.
 */
export function unflatten(flat, entry) {
	return {
		enabled: flat.enabled,
		adapters: {
			telegram: {
				...entry?.adapters?.telegram,
				enabled: flat.telegramEnabled,
				token: flat.telegramToken,
				allowedUserIds: splitIds(flat.telegramAllowedUserIds).map(Number)
			},
			feishu: {
				...entry?.adapters?.feishu,
				enabled: flat.feishuEnabled,
				appId: flat.feishuAppId,
				appSecret: flat.feishuAppSecret,
				allowedUserIds: splitIds(flat.feishuAllowedUserIds)
			},
			lark: {
				...entry?.adapters?.lark,
				enabled: flat.larkEnabled,
				appId: flat.larkAppId,
				appSecret: flat.larkAppSecret,
				allowedUserIds: splitIds(flat.larkAllowedUserIds)
			},
			wecom: {
				...entry?.adapters?.wecom,
				enabled: flat.wecomEnabled,
				corpId: flat.wecomCorpId,
				corpSecret: flat.wecomCorpSecret,
				agentId: flat.wecomAgentId,
				token: flat.wecomToken,
				encodingAesKey: flat.wecomEncodingAesKey,
				allowedUserIds: splitIds(flat.wecomAllowedUserIds)
			},
			mock: {
				...entry?.adapters?.mock,
				enabled: flat.mockEnabled,
				port: flat.mockPort
			}
		},
		agent: {
			...entry?.agent,
			cwd: flat.agentCwd,
			provider: flat.agentProvider,
			model: flat.agentModel,
			maxMessageLength: flat.agentMaxMessageLength
		},
		http: {
			...entry?.http,
			host: flat.httpHost,
			port: flat.httpPort
		}
	};
}

/**
 * Mount the IM bridge and wire it to the settings service.
 * @param ctx - plugin context carrying the core services.
 * @param config - validated bridge configuration (schema defaults applied).
 */
export function apply(ctx, config) {
	const entry = config ?? {};
	let bridge;
	/** Current effective config source: entry until settings mount, then resolved. */
	let source = () => entry;

	/** (Re)create the bridge from the current effective config. */
	const sync = () => {
		if (bridge !== undefined) {
			bridge.stop();
			bridge = undefined;
		}
		const effective = source();
		if (effective.enabled === false) return;
		bridge = new Bridge(ctx, effective);
		// Start asynchronously; failures surface through the logger, not the boot
		// path, so a misconfigured adapter never bricks the profile.
		bridge.start().catch((error) => {
			ctx.logger?.warn?.(`dsh-im-hub: failed to start: ${error instanceof Error ? error.message : String(error)}`);
		});
	};

	installSettingsSection(ctx, SETTINGS_NAMESPACE, flatSchema, flatten(entry), {
		setSource: (read) => {
			source = () => unflatten(read() ?? {}, entry);
		},
		onChange: sync
	});
	ctx.on('dispose', () => {
		if (bridge !== undefined) bridge.stop();
	});
	sync();
}
