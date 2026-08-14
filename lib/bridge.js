// Bridge core: inbound IM messages -> dsh agents -> outbound replies.
//
// Design notes
// ------------
// * One live agent per IM chat (`key = platform:chatId`). The agent keeps its
//   session so multi-turn conversations hold context, mirroring a normal chat
//   with the harness rather than one-shot headless runs.
// * Messages to the same chat are serialized through a per-chat promise chain,
//   so a busy agent never interleaves two turns from one chat.
// * Assistant text is collected from `session/event` appends (`assistant/message`)
//   instead of polling, keyed by the agent's session id. The final aggregated
//   text is sent after `turn/end`; on tool-heavy turns the model's intermediate
//   assistant messages are preserved in order.
// * Chats are disposable: `/reset` or an idle timeout disposes the agent, which
//   also removes its session from the store.

import { randomUUID } from 'node:crypto';
import { installModelSelection } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';

/** Chunk a long text into <= maxLen pieces on newline boundaries when possible. */
export function splitText(text, maxLen) {
	if (text.length <= maxLen) return [text];
	const chunks = [];
	let rest = text;
	while (rest.length > maxLen) {
		let cut = rest.lastIndexOf('\n', maxLen);
		if (cut < maxLen / 2) cut = rest.lastIndexOf(' ', maxLen);
		if (cut < maxLen / 2) cut = maxLen;
		chunks.push(rest.slice(0, cut).trim());
		rest = rest.slice(cut).trimStart();
	}
	if (rest.length > 0) chunks.push(rest);
	return chunks;
}

/** Aggregate the plain-text content of an assistant message. */
function assistantText(message) {
	return message.content
		.filter((block) => block.type === 'text')
		.map((block) => block.text)
		.join('');
}

export class Bridge {
	/**
	 * @param ctx - plugin context with `agentDefaultModel`, `agents`, `sessions`, `loader`.
	 * @param config - validated bridge configuration (see lib/index.js Config).
	 */
	constructor(ctx, config) {
		this.ctx = ctx;
		this.config = config;
		/** key (platform:chatId) -> chat state. */
		this.chats = new Map();
		/** sessionId -> pending reply collector for in-flight turns. */
		this.pending = new Map();
		/** started adapters, each { name, stop() }. */
		this.adapters = [];
		/** disposal of the global session/event listener. */
		this.disposeListener = undefined;
		this.stopped = false;
		this.idleTimer = undefined;
	}

	// ------------------------------------------------------------------ life

	async start() {
		const { default: createAdapters } = await import('./adapters/index.js');
		this.disposeListener = this.ctx.on('session/event', (session, event) => {
			const collector = this.pending.get(session.id);
			if (collector === undefined) return;
			if (event.type === 'assistant/message') {
				const text = assistantText(event.data.message);
				if (text !== '') collector.parts.push(text);
			} else if (event.type === 'turn/end') {
				collector.reason = event.data.reason;
			}
		});
		const adapters = createAdapters({
			config: this.config,
			onMessage: (input) => this.handleMessage(input),
			logger: this.ctx.logger
		});
		for (const adapter of adapters) {
			try {
				await adapter.start();
				this.adapters.push(adapter);
				this.ctx.logger?.info?.(`dsh-im-gateway: ${adapter.name} adapter started`);
			} catch (error) {
				this.ctx.logger?.warn?.(`dsh-im-gateway: ${adapter.name} adapter failed to start: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		if (this.config.agent.idleTimeoutMs > 0) {
			this.idleTimer = setInterval(() => this.reapIdle(), Math.min(this.config.agent.idleTimeoutMs, 60_000));
			this.idleTimer.unref?.();
		}
	}

	stop() {
		this.stopped = true;
		if (this.disposeListener !== undefined) this.disposeListener();
		if (this.idleTimer !== undefined) clearInterval(this.idleTimer);
		for (const adapter of this.adapters) {
			try {
				adapter.stop();
			} catch {
				/* containment */
			}
		}
		this.adapters = [];
		for (const chat of this.chats.values()) {
			chat.dispose().catch(() => {});
		}
		this.chats.clear();
	}

	// -------------------------------------------------------------- messaging

	/**
	 * Entry point called by every adapter for an inbound user message.
	 * @param input - { platform, chatId, userId, text, messageId, reply(text, opts?) }.
	 */
	async handleMessage(input) {
		const { platform, chatId, userId, text } = input;
		const key = `${platform}:${chatId}`;
		if (typeof text !== 'string' || text.trim() === '') return;
		if (!this.isAllowed(platform, userId)) {
			await input.reply('⛔ 你没有权限使用此助手 / You are not allowed to use this assistant.');
			return;
		}
		if (text.startsWith('/')) {
			await this.handleCommand(key, text, input);
			return;
		}
		const chat = await this.getOrCreateChat(key);
		// Serialize turns per chat: queue behind the previous turn.
		const run = chat.busy.then(() => this.runTurn(chat, input));
		chat.busy = run.catch(() => {});
		await run;
	}

	isAllowed(platform, userId) {
		const adapters = this.config.adapters;
		let allow = [];
		if (platform === 'telegram') allow = adapters.telegram.allowedUserIds?.map(String) ?? [];
		else if (platform === 'feishu') allow = adapters.feishu.allowedUserIds ?? [];
		else if (platform === 'wecom') allow = adapters.wecom.allowedUserIds ?? [];
		return allow.length === 0 || allow.includes(String(userId));
	}

	async handleCommand(key, text, input) {
		const [cmd, ...rest] = text.split(/\s+/);
		const arg = rest.join(' ');
		switch (cmd) {
			case '/help':
				await input.reply([
					'📖 可用命令:',
					'  /help   - 显示帮助',
					'  /reset  - 清空当前会话上下文,重新开始',
					'  /status - 显示运行状态',
					'  /model  - 显示当前模型',
					'直接发送消息即可与 dsh 智能体对话。'
				].join('\n'));
				break;
			case '/reset': {
				const chat = this.chats.get(key);
				if (chat !== undefined) {
					this.chats.delete(key);
					await chat.dispose();
					await input.reply('🔄 已清空上下文,开始新的会话。');
				} else {
					await input.reply('当前没有活跃会话。');
				}
				break;
			}
			case '/status': {
				const agents = this.ctx.agents;
				await input.reply([
					`📊 状态:`,
					`  活跃 IM 会话: ${this.chats.size}`,
					`  活跃 dsh 智能体: ${agents.list().length}`,
					`  适配器: ${this.adapters.map((a) => a.name).join(', ') || '无'}`
				].join('\n'));
				break;
			}
			case '/model': {
				const selection = this.ctx.get('agentDefaultModel')?.currentSelection?.();
				await input.reply(`🤖 当前模型: ${selection ? `${selection.provider} / ${selection.model}` : '未知'}`);
				break;
			}
			default:
				await input.reply(`未知命令: ${cmd} (输入 /help 查看可用命令)`);
		}
	}

	// ----------------------------------------------------------------- chats

	async getOrCreateChat(key) {
		let chat = this.chats.get(key);
		if (chat === undefined) {
			chat = await this.createChat(key);
			this.chats.set(key, chat);
		}
		chat.lastUsed = Date.now();
		return chat;
	}

	async createChat(key) {
		const ctx = this.ctx;
		const defaultModel = ctx.get('agentDefaultModel');
		const selection = defaultModel?.currentSelection?.();
		if (selection === undefined) throw new Error('agentDefaultModel service is unavailable');
		const provider = this.config.agent.provider || selection.provider;
		const model = this.config.agent.model || selection.model;
		const cwd = this.config.agent.cwd || process.cwd();
		const sessionId = SessionId(`im-${randomUUID()}`);
		const handle = await ctx.agents.create({
			sessionId,
			meta: { cwd },
			agentOptions: { provider, model },
			setup: (agentCtx) => {
				installModelSelection(agentCtx, {
					current: { provider, model },
					assembled: undefined
				});
			}
		});
		await handle.agent.whenIdle();
		const chat = {
			key,
			agent: handle.agent,
			dispose: handle.dispose,
			busy: Promise.resolve(),
			lastUsed: Date.now()
		};
		return chat;
	}

	async runTurn(chat, input) {
		const { text, reply } = input;
		const sessionId = chat.agent.session.id;
		const collector = { parts: [], reason: undefined };
		this.pending.set(sessionId, collector);
		try {
			const prefix = this.config.agent.instructionPrefix;
			const content = prefix ? `${prefix}\n\n${text}` : text;
			chat.agent.followup(createUserMessage({
				content: [{ type: 'text', text: content }],
				source: { kind: 'plugin', plugin: 'dsh-im-gateway', form: 'relay' }
			}));
			await chat.agent.whenIdle();
			await this.ctx.sessions.flush(chat.agent.session);
			const answer = collector.parts.join('\n\n').trim();
			const reason = collector.reason;
			if (reason?.kind === 'error') {
				const err = reason.error;
				await reply(`⚠️ 出错了: ${err.code}: ${err.message}`);
				return;
			}
			if (answer === '') {
				await reply('(无文本回复)');
				return;
			}
			for (const chunk of splitText(answer, this.config.agent.maxMessageLength)) {
				await reply(chunk);
			}
		} catch (error) {
			try {
				await input.reply(`❌ 执行失败: ${error instanceof Error ? error.message : String(error)}`);
			} catch {
				/* containment */
			}
		} finally {
			this.pending.delete(sessionId);
		}
	}

	reapIdle() {
		const now = Date.now();
		const timeout = this.config.agent.idleTimeoutMs;
		for (const [key, chat] of this.chats) {
			if (now - chat.lastUsed > timeout) {
				this.chats.delete(key);
				chat.dispose().catch(() => {});
			}
		}
	}
}
