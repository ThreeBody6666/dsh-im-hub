// Feishu (Lark) adapter — WebSocket long-connection or Webhook mode.
//
// websocket mode (default): the official long connection. No public endpoint
// is needed; the adapter asks Feishu for a wss URL and receives events over
// it. Requires a custom app with the `im.message.receive_v1` event subscribed.
//
// The long connection is NOT plain JSON: every WebSocket binary message is a
// protobuf `pbbp2.Frame` (see feishu-ws-frame.js). The client keeps the link
// alive by sending its own ping control frames and must ACK each event within
// ~3s, otherwise Feishu redelivers.
//
// webhook mode: an HTTP callback server (config.http) receives events pushed
// by Feishu; a public URL (or tunnel) must be configured in the Feishu admin
// console as the event request URL.
//
// Docs: https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/request-url-configuration-case

import { createServer } from 'node:http';
import { encodeFrame, decodeFrame, headerMap, payloadJson } from './feishu-ws-frame.js';

const OPEN = 'https://open.feishu.cn';

/** Eagerly fail when a Feishu API envelope reports an error. */
function envelope(json) {
	if (json?.code !== 0) {
		throw new Error(`feishu api: ${json?.code ?? '?'} ${json?.msg ?? json?.message ?? 'unknown error'}`);
	}
	return json;
}

/** Extract plain text from an im.message.receive_v1 event. */
export function extractTextEvent(event) {
	const message = event?.event?.message;
	if (message === undefined) return undefined;
	if (message.message_type !== 'text') return undefined;
	try {
		const content = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
		return typeof content?.text === 'string' ? content.text : undefined;
	} catch {
		return undefined;
	}
}

/**
 * @param options - { appId, appSecret, mode, webhookPath, verificationToken, allowedUserIds, http, onMessage, logger }.
 */
export function createFeishuAdapter(options) {
	const { appId, appSecret, mode = 'websocket', webhookPath = '/feishu', verificationToken = '', allowedUserIds = [], http, onMessage, logger } = options;

	let token = '';
	let tokenExpiresAt = 0;
	let ws;
	let wsRetryTimer;
	let pingTimer;
	let server;
	let stopped = false;
	/** Deduplicate events by message_id (at-least-once delivery). */
	const seenMessages = new Set();
	/** client-issued ping interval in ms, overridable via pong. */
	let pingIntervalMs = 120_000;

	async function getToken() {
		if (token !== '' && Date.now() < tokenExpiresAt - 60_000) return token;
		const res = await fetch(`${OPEN}/open-apis/auth/v3/tenant_access_token/internal`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ app_id: appId, app_secret: appSecret })
		});
		const json = envelope(await res.json());
		token = json.tenant_access_token;
		tokenExpiresAt = Date.now() + json.expire * 1000;
		return token;
	}

	async function send(chatId, text) {
		const at = await getToken();
		const res = await fetch(`${OPEN}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				receive_id: chatId,
				msg_type: 'text',
				content: JSON.stringify({ text })
			})
		});
		envelope(await res.json());
	}

	function dispatch(event) {
		if (event?.header?.event_type !== 'im.message.receive_v1') return;
		const text = extractTextEvent(event);
		if (text === undefined) return;
		const e = event.event;
		const chatId = e.message.chat_id;
		const userId = e.sender?.sender_id?.open_id ?? '';
		if (allowedUserIds.length > 0 && !allowedUserIds.includes(userId)) return;
		const reply = (replyText) => send(chatId, replyText);
		onMessage({
			platform: 'feishu',
			chatId,
			userId,
			text,
			messageId: e.message.message_id ?? '',
			reply
		}).catch((error) => {
			logger?.warn?.(`dsh-im-hub: feishu message handling failed: ${error instanceof Error ? error.message : String(error)}`);
		});
	}

	/** Handle one decoded data frame (method=1) carrying an event payload. */
	function handleEventFrame(frame, serviceId) {
		const headers = headerMap(frame);
		if (headers.type !== 'event') return;
		const messageId = headers.message_id ?? '';
		// De-dup by message id (bounded; drop oldest beyond 10k).
		if (messageId !== '') {
			if (seenMessages.has(messageId)) return;
			seenMessages.add(messageId);
			if (seenMessages.size > 10_000) {
				const first = seenMessages.values().next().value;
				seenMessages.delete(first);
			}
		}
		const event = payloadJson(frame);
		if (event !== undefined) dispatch(event);
		// ACK within 3s: echo the frame's seq/log/service/method/headers + payload {"code":200}.
		try {
			ws.send(encodeFrame({
				seqID: frame.seqID,
				logID: frame.logID,
				service: serviceId,
				method: frame.method,
				headers: frame.headers ?? [],
				payloadType: 'json',
				payload: Buffer.from(JSON.stringify({ code: 200 }), 'utf8')
			}));
		} catch {
			/* socket mid-close */
		}
	}

	// ------------------------------------------------------------- websocket

	async function connectWs() {
		if (stopped) return;
		try {
			// 1) Ask Feishu for a temporary wss endpoint.
			const res = await fetch(`${OPEN}/callback/ws/endpoint`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ AppID: appId, AppSecret: appSecret })
			});
			const json = envelope(await res.json());
			const url = json.data?.URL;
			if (typeof url !== 'string') throw new Error('feishu ws handshake returned no URL');
			const serviceId = Number(new URL(url).searchParams.get('service_id') ?? 0);
			const clientConfig = json.data?.ClientConfig;
			if (Number.isFinite(clientConfig?.PingInterval) && clientConfig.PingInterval > 0) {
				pingIntervalMs = clientConfig.PingInterval * 1000;
			}
			logger?.info?.(`dsh-im-hub: feishu long connection obtained (service ${serviceId})`);

			// 2) Connect to the wss URL.
			ws = new WebSocket(url);
			ws.binaryType = 'arraybuffer';
			ws.onopen = () => {
				logger?.info?.('dsh-im-hub: feishu websocket connected');
				// 3) Client-driven keepalive: send a ping control frame on interval.
				clearInterval(pingTimer);
				pingTimer = setInterval(() => {
					try {
						ws.send(encodeFrame({
							seqID: 0,
							logID: 0,
							service: serviceId,
							method: 0,
							headers: [{ key: 'type', value: 'ping' }]
						}));
					} catch {
						/* socket mid-close */
					}
				}, pingIntervalMs);
				pingTimer.unref?.();
			};
			ws.onmessage = (ev) => {
				if (typeof ev.data === 'string') return; // no text frames expected
				let frame;
				try {
					frame = decodeFrame(ev.data);
				} catch (error) {
					logger?.warn?.(`dsh-im-hub: feishu frame decode failed: ${error instanceof Error ? error.message : String(error)}`);
					return;
				}
				if (frame.method === 1) {
					handleEventFrame(frame, serviceId);
				} else {
					// control frame: inspect type header for pong.
					const headers = headerMap(frame);
					if (headers.type === 'pong') {
						const cfg = payloadJson(frame);
						if (Number.isFinite(cfg?.PingInterval) && cfg.PingInterval > 0) {
							pingIntervalMs = cfg.PingInterval * 1000;
						}
					}
				}
			};
			ws.onclose = () => {
				clearInterval(pingTimer);
				if (!stopped) {
					logger?.warn?.('dsh-im-hub: feishu websocket closed, reconnecting in 5s');
					wsRetryTimer = setTimeout(connectWs, 5000);
				}
			};
			ws.onerror = (ev) => {
				logger?.warn?.(`dsh-im-hub: feishu websocket error: ${ev?.message ?? 'unknown'}`);
			};
		} catch (error) {
			logger?.warn?.(`dsh-im-hub: feishu websocket connect failed: ${error instanceof Error ? error.message : String(error)}; retrying in 10s`);
			if (!stopped) wsRetryTimer = setTimeout(connectWs, 10_000);
		}
	}

	// ------------------------------------------------------------------ http

	function handleHttp(req, res) {
		const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
		if (url.pathname !== webhookPath) {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('not found');
			return;
		}
		if (req.method !== 'POST') {
			res.writeHead(405, { 'Content-Type': 'text/plain' });
			res.end('method not allowed');
			return;
		}
		let body = '';
		req.on('data', (chunk) => { body += chunk; });
		req.on('end', () => {
			let payload;
			try {
				payload = JSON.parse(body);
			} catch {
				res.writeHead(400, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ code: 400, msg: 'invalid json' }));
				return;
			}
			// URL-verification handshake: echo the challenge back.
			if (payload?.type === 'url_verification') {
				const challenge = payload.challenge ?? payload.header?.challenge;
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ challenge }));
				return;
			}
			// Optional token check.
			const eventToken = payload?.token ?? payload?.header?.token;
			if (verificationToken !== '' && eventToken !== verificationToken) {
				res.writeHead(403, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ code: 403, msg: 'bad token' }));
				return;
			}
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ code: 0, msg: 'success' }));
			dispatch(payload);
		});
	}

	async function startHttp() {
		const host = http?.host ?? '0.0.0.0';
		const port = http?.port ?? 8080;
		server = createServer(handleHttp);
		await new Promise((resolve, reject) => {
			server.once('error', reject);
			server.listen(port, host, () => {
				server.removeListener('error', reject);
				logger?.info?.(`dsh-im-hub: feishu webhook server listening on http://${host}:${port}${webhookPath}`);
				resolve();
			});
		});
	}

	// ------------------------------------------------------------------ api

	return {
		name: 'feishu',
		async start() {
			// Validate credentials eagerly.
			await getToken();
			if (mode === 'webhook') {
				await startHttp();
			} else {
				await connectWs();
			}
		},
		stop() {
			stopped = true;
			if (wsRetryTimer !== undefined) clearTimeout(wsRetryTimer);
			if (pingTimer !== undefined) clearInterval(pingTimer);
			if (ws !== undefined) {
				try {
					ws.close();
				} catch {
					/* containment */
				}
			}
			if (server !== undefined) server.close();
		}
	};
}
