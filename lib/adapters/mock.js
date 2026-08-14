// Mock adapter — for local testing without a real IM platform.
//
// Reads one message per line from stdin (or an optional HTTP endpoint) and
// prints replies to stdout. Enable it from the profile patch:
//
//   - id: im-bridge
//     disabled: false
//     config:
//       adapters:
//         mock:
//           enabled: true
//
//   Then pipe a message in:  echo "hello" | dsh --profile im

import { createInterface } from 'node:readline';
import { createServer } from 'node:http';

/**
 * @param options - { enabled, onMessage, logger, port }.
 */
export function createMockAdapter(options) {
	const { onMessage, logger, port = 0 } = options;
	let stopped = false;
	let rl;
	let server;

	function handleText(text, chatId, userId) {
		const reply = async (replyText) => {
			console.log(`[mock reply -> ${chatId}] ${replyText}`);
			logger?.info?.(`mock reply to ${chatId}: ${replyText.slice(0, 80)}`);
		};
		return onMessage({
			platform: 'mock',
			chatId: String(chatId ?? 'stdin'),
			userId: String(userId ?? 'tester'),
			text,
			messageId: `mock-${Date.now()}`,
			reply
		}).catch((error) => {
			logger?.warn?.(`dsh-im-hub: mock message handling failed: ${error instanceof Error ? error.message : String(error)}`);
		});
	}

	return {
		name: 'mock',
		async start() {
			// Line-based stdin interface.
			rl = createInterface({ input: process.stdin });
			rl.on('line', (line) => {
				if (line.trim() === '') return;
				handleText(line, 'stdin', 'tester');
			});
			// Optional tiny HTTP endpoint: POST { "text": "..." } to /mock.
			server = createServer((req, res) => {
				if (req.method !== 'POST') {
					res.writeHead(405);
					res.end();
					return;
				}
				let body = '';
				req.on('data', (chunk) => { body += chunk; });
				req.on('end', () => {
					let json = {};
					try {
						json = JSON.parse(body);
					} catch {
						/* keep empty */
					}
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ ok: true }));
					if (typeof json?.text === 'string') {
						handleText(json.text, json.chatId ?? 'http', json.userId ?? 'tester');
					}
				});
			});
			server.listen(port, '127.0.0.1', () => {
				const actual = server.address().port;
				console.log(`[mock adapter listening on http://127.0.0.1:${actual}/mock]`);
				logger?.info?.(`dsh-im-hub: mock adapter ready (stdin + http://127.0.0.1:${actual}/mock)`);
			});
		},
		stop() {
			stopped = true;
			rl?.close();
			if (server !== undefined) server.close();
		}
	};
}
