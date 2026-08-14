// WeCom (WeChat Work) adapter — callback mode.
//
// WeCom apps deliver inbound messages to a callback URL you configure in the
// admin console. This adapter runs a small HTTP server (config.http), verifies
// the callback signature, decrypts the message (WXBizMsgCrypt / AES-256-CBC),
// and replies through the app-message send API. A public URL (or an
// intranet-tunnel tool like ngrok / frp) is required so WeCom can reach the
// callback server.
//
// Docs: https://developer.work.weixin.qq.com/document/path/90968 (callback),
//       https://developer.work.weixin.qq.com/document/path/90236 (send message)

import { createHash, createDecipheriv } from 'node:crypto';
import { createServer } from 'node:http';

const API = 'https://qyapi.weixin.qq.com/cgi-bin';

/** WeCom callback signature: sha1 of the sorted [token, timestamp, nonce, encrypt]. */
export function signature(token, timestamp, nonce, encrypt) {
	const list = [token, timestamp, nonce, encrypt].sort();
	return createHash('sha1').update(list.join('')).digest('hex');
}

/**
 * Decrypt a WeCom callback payload (WXBizMsgCrypt).
 * @param encrypt - base64 ciphertext.
 * @param encodingAesKey - 43-char EncodingAESKey from the admin console.
 * @returns { message, receiveId } — decrypted plaintext and the receive id (corpid).
 */
export function decryptMessage(encrypt, encodingAesKey) {
	const key = Buffer.from(`${encodingAesKey}=`, 'base64');
	if (key.length !== 32) throw new Error(`invalid encodingAesKey length: expected 32 bytes, got ${key.length}`);
	const iv = key.subarray(0, 16);
	const decipher = createDecipheriv('aes-256-cbc', key, iv);
	decipher.setAutoPadding(false);
	let plain = Buffer.concat([decipher.update(Buffer.from(encrypt, 'base64')), decipher.final()]);
	// Strip PKCS7 padding.
	const pad = plain[plain.length - 1];
	if (pad < 1 || pad > 32 || pad > plain.length) throw new Error('invalid PKCS7 padding');
	plain = plain.subarray(0, plain.length - pad);
	// Structure: 16 random bytes + 4-byte big-endian msg length + msg + receiveId.
	const msgLen = plain.readUInt32BE(16);
	const message = plain.subarray(20, 20 + msgLen).toString('utf8');
	const receiveId = plain.subarray(20 + msgLen).toString('utf8');
	return { message, receiveId };
}

/** Escape XML text nodes (used when echoing the challenge). */
function escapeXml(text) {
	return String(text).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}

/** Parse the outer <xml><Encrypt>…</Encrypt></xml> callback body. */
function extractEncrypt(xml) {
	const match = /<Encrypt><!\[CDATA\[([\s\S]*?)\]\]><\/Encrypt>/.exec(xml);
	if (match === null) {
		const plain = /<Encrypt>([\s\S]*?)<\/Encrypt>/.exec(xml);
		if (plain === null) throw new Error('callback body has no <Encrypt> node');
		return plain[1];
	}
	return match[1];
}

/** Parse a decrypted text message XML into fields. */
export function parseTextMessageXml(xml) {
	const field = (name) => {
		const re = new RegExp(`<${name}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${name}>`);
		const m = re.exec(xml);
		if (m !== null) return m[1];
		const m2 = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
		return m2 === null ? undefined : m2[1];
	};
	const num = (name) => {
		const v = field(name);
		return v === undefined ? undefined : Number(v);
	};
	return {
		toUserName: field('ToUserName'),
		fromUserName: field('FromUserName'),
		createTime: num('CreateTime'),
		msgType: field('MsgType'),
		content: field('Content'),
		msgId: field('MsgId'),
		agentId: num('AgentID')
	};
}

/**
 * @param options - { corpId, corpSecret, agentId, token, encodingAesKey, path, allowedUserIds, http, onMessage, logger }.
 */
export function createWecomAdapter(options) {
	const { corpId, corpSecret, agentId, token, encodingAesKey, path = '/wecom', allowedUserIds = [], http, onMessage, logger } = options;
	const host = http?.host ?? '0.0.0.0';
	const port = http?.port ?? 8080;

	let accessToken = '';
	let tokenExpiresAt = 0;
	let server;
	let stopped = false;

	async function getAccessToken() {
		if (accessToken !== '' && Date.now() < tokenExpiresAt - 60_000) return accessToken;
		const url = `${API}/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(corpSecret)}`;
		const res = await fetch(url);
		const json = await res.json();
		if (json.errcode !== 0) throw new Error(`wecom gettoken: ${json.errcode} ${json.errmsg}`);
		accessToken = json.access_token;
		tokenExpiresAt = Date.now() + json.expires_in * 1000;
		return accessToken;
	}

	async function send(chatId, text) {
		const at = await getAccessToken();
		const res = await fetch(`${API}/message/send?access_token=${encodeURIComponent(at)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				touser: chatId,
				msgtype: 'text',
				agentid: Number(agentId),
				text: { content: text }
			})
		});
		const json = await res.json();
		if (json.errcode !== 0) throw new Error(`wecom send: ${json.errcode} ${json.errmsg}`);
	}

	function handleGet(req, res, url) {
		const { msg_signature: msgSignature, timestamp, nonce, echostr } = Object.fromEntries(url.searchParams);
		if (signature(token, timestamp, nonce, echostr) !== msgSignature) {
			res.writeHead(403, { 'Content-Type': 'text/plain' });
			res.end('invalid signature');
			return;
		}
		const plain = decryptMessage(echostr, encodingAesKey);
		res.writeHead(200, { 'Content-Type': 'text/plain' });
		res.end(plain.message); // echo the decrypted challenge verbatim
	}

	async function handlePost(req, res, url) {
		let body = '';
		for await (const chunk of req) body += chunk;
		const encrypt = extractEncrypt(body);
		const { msg_signature: msgSignature, timestamp, nonce } = Object.fromEntries(url.searchParams);
		if (signature(token, timestamp, nonce, encrypt) !== msgSignature) {
			res.writeHead(403, { 'Content-Type': 'text/plain' });
			res.end('invalid signature');
			return;
		}
		const { message } = decryptMessage(encrypt, encodingAesKey);
		const msg = parseTextMessageXml(message);
		res.writeHead(200, { 'Content-Type': 'application/xml' });
		res.end('<xml><Encrypt><![CDATA[]]></Encrypt><MsgSignature><![CDATA[]]></MsgSignature><TimeStamp></TimeStamp><Nonce><![CDATA[]]></Nonce></xml>');

		if (msg.msgType !== 'text' || msg.content === undefined) return;
		if (allowedUserIds.length > 0 && !allowedUserIds.includes(msg.fromUserName)) return;
		const reply = (replyText) => send(msg.fromUserName, replyText);
		try {
			await onMessage({
				platform: 'wecom',
				chatId: msg.fromUserName,
				userId: msg.fromUserName,
				text: msg.content,
				messageId: msg.msgId ?? '',
				reply
			});
		} catch (error) {
			logger?.warn?.(`dsh-im-hub: wecom message handling failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	return {
		name: 'wecom',
		async start() {
			// Validate credentials eagerly.
			await getAccessToken();
			server = createServer((req, res) => {
				const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
				if (url.pathname !== path) {
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('not found');
					return;
				}
				if (req.method === 'GET') handleGet(req, res, url);
				else if (req.method === 'POST') handlePost(req, res, url).catch((error) => {
					logger?.warn?.(`dsh-im-hub: wecom callback error: ${error instanceof Error ? error.message : String(error)}`);
					if (!res.headersSent) {
						res.writeHead(500, { 'Content-Type': 'text/plain' });
						res.end('error');
					}
				});
				else {
					res.writeHead(405, { 'Content-Type': 'text/plain' });
					res.end('method not allowed');
				}
			});
			await new Promise((resolve, reject) => {
				server.once('error', reject);
				server.listen(port, host, () => {
					server.removeListener('error', reject);
					logger?.info?.(`dsh-im-hub: wecom callback server listening on http://${host}:${port}${path}`);
					resolve();
				});
			});
		},
		stop() {
			stopped = true;
			if (server !== undefined) server.close();
		}
	};
}
