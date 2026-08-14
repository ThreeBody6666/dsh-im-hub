// Telegram adapter — long-polling mode (no public endpoint needed).
//
// Protocol: Bot API getUpdates long polling. Create a bot with @BotFather,
// then put the token in the profile patch:
//
//   - id: im-bridge
//     disabled: false
//     config:
//       adapters:
//         telegram:
//           enabled: true
//           token: '123456:ABC-DEF...'
//
// Docs: https://core.telegram.org/bots/api

const API = 'https://api.telegram.org';

/** Hard Bot API limit per text message. */
const TELEGRAM_MAX = 4096;

function splitTelegramText(text) {
	if (text.length <= TELEGRAM_MAX) return [text];
	const parts = [];
	let rest = text;
	while (rest.length > TELEGRAM_MAX) {
		let cut = rest.lastIndexOf('\n', TELEGRAM_MAX);
		if (cut < TELEGRAM_MAX / 2) cut = rest.lastIndexOf(' ', TELEGRAM_MAX);
		if (cut < TELEGRAM_MAX / 2) cut = TELEGRAM_MAX;
		parts.push(rest.slice(0, cut).trim());
		rest = rest.slice(cut).trimStart();
	}
	if (rest) parts.push(rest);
	return parts;
}

/**
 * @param options - { token, allowedUserIds, timeoutSeconds, pollIntervalMs, onMessage, logger }.
 */
export function createTelegramAdapter(options) {
	const { token, allowedUserIds = [], timeoutSeconds = 50, pollIntervalMs = 500, onMessage, logger } = options;

	let offset = 0;
	let stopped = false;
	let pollTimer;
	let started = false;

	async function call(method, params = {}) {
		const res = await fetch(`${API}/bot${token}/${method}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params)
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(`telegram ${method}: HTTP ${res.status} ${body.slice(0, 200)}`);
		}
		const json = await res.json();
		if (!json.ok) {
			throw new Error(`telegram ${method}: ${json.description ?? 'unknown error'} (${json.error_code ?? '?'})`);
		}
		return json.result;
	}

	async function send(chatId, text) {
		for (const chunk of splitTelegramText(text)) {
			await call('sendMessage', { chat_id: Number(chatId), text: chunk });
		}
	}

	async function poll() {
		if (stopped) return;
		try {
			const updates = await call('getUpdates', {
				timeout: timeoutSeconds,
				offset,
				allowed_updates: ['message']
			});
			for (const update of updates ?? []) {
				offset = Math.max(offset, update.update_id + 1);
				const msg = update.message;
				if (msg === undefined) continue;
				if (msg.text === undefined && msg.caption === undefined) continue;
				const text = msg.text ?? msg.caption ?? '';
				if (text === '') continue;
				const chatId = String(msg.chat.id);
				const userId = msg.from?.id;
				if (allowedUserIds.length > 0 && !allowedUserIds.includes(Number(userId))) continue;
				const reply = (replyText) => send(chatId, replyText);
				try {
					await onMessage({
						platform: 'telegram',
						chatId,
						userId: String(userId ?? ''),
						text,
						messageId: String(msg.message_id ?? ''),
						reply
					});
				} catch (error) {
					logger?.warn?.(`dsh-im-hub: telegram message handling failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		} catch (error) {
			logger?.warn?.(`dsh-im-hub: telegram poll failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			pollTimer = setTimeout(poll, pollIntervalMs);
		}
	}

	return {
		name: 'telegram',
		async start() {
			if (started) return;
			started = true;
			// Verify the token eagerly so misconfiguration surfaces at boot.
			const me = await call('getMe');
			logger?.info?.(`dsh-im-hub: telegram bot @${me.username ?? me.id} connected`);
			poll();
		},
		stop() {
			stopped = true;
			if (pollTimer !== undefined) clearTimeout(pollTimer);
		}
	};
}
