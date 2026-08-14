// dsh-im-gateway — turn a DeepSeek Harness (dsh) agent into an IM assistant.
//
// This is a dsh *bundle* plugin: package.json declares `dsh.bundle.patch` →
// ./cordis.patch.yml, which inserts the `im-gateway` row into the profile's
// Cordis loader tree. When enabled (see the patch file), this plugin mounts
// one or more IM adapters (Feishu / WeCom / Telegram), bridges inbound chat
// messages into dsh agents, and relays the agent's replies back to the chat.
//
// The driving pattern mirrors @deepseek-ai/dsh-headless: create an agent
// through the core registry (`ctx.agents`), followup a user message, wait for
// quiescence, and read the assistant text back from the session log. Unlike
// headless, the bridge keeps agents alive per chat so multi-turn conversations
// retain context, and it streams the session events to the IM side.

import z from '@deepseek-ai/schemastery';
import { Bridge } from './bridge.js';

/** Stable Cordis plugin name (row id in the bundle patch). */
export const name = 'dsh-im-gateway';

/**
 * Core services the bridge needs before it can drive turns. `loader` is
 * awaited at start so the whole tree is mounted before the first message.
 */
export const inject = ['agentDefaultModel', 'agents', 'sessions', 'loader'];

/** Configuration schema (validated by the Cordis loader). */
export const Config = z.object({
	adapters: z.object({
		telegram: z.object({
			enabled: z.boolean().default(false),
			/** Bot token from BotFather: `123456:ABC-DEF...` */
			token: z.string().default(''),
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
			appSecret: z.string().default(''),
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
		wecom: z.object({
			enabled: z.boolean().default(false),
			/** Corp id (企业ID). */
			corpId: z.string().default(''),
			/** Secret of the app used to send messages (应用的Secret). */
			corpSecret: z.string().default(''),
			/** Agent id of that app. */
			agentId: z.string().default(''),
			/** Callback Token configured in WeCom admin console (接收消息服务器配置). */
			token: z.string().default(''),
			/** Callback EncodingAESKey (43 chars). */
			encodingAesKey: z.string().default(''),
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

/**
 * Mount the IM bridge.
 * @param ctx - plugin context carrying the core services.
 * @param config - validated bridge configuration.
 */
export function apply(ctx, config) {
	const bridge = new Bridge(ctx, config);
	// Start asynchronously; failures are surfaced through the logger, not the
	// boot path, so a misconfigured adapter never bricks the profile.
	bridge.start().catch((error) => {
		ctx.logger?.warn?.(`dsh-im-gateway: failed to start: ${error instanceof Error ? error.message : String(error)}`);
	});
	ctx.on('dispose', () => bridge.stop());
}
