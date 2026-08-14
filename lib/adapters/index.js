// Adapter registry: instantiate every enabled IM adapter.
//
// Each adapter exposes the minimal surface the Bridge needs:
//   { name: string, start(): Promise<void>, stop(): void }
// and calls `onMessage({ platform, chatId, userId, text, messageId, reply })`
// for every inbound user message. `reply(text, opts?)` must deliver one text
// message back to the same chat.

import { createTelegramAdapter } from './telegram.js';
import { createFeishuAdapter } from './feishu.js';
import { createWecomAdapter } from './wecom.js';
import { createMockAdapter } from './mock.js';

/**
 * @param options - { config, onMessage, logger }.
 * @returns the list of started-enabled adapter factories (not yet started).
 */
export default function createAdapters(options) {
	const { config, onMessage, logger } = options;
	const adapters = [];
	const common = { onMessage, logger };

	if (config.adapters.telegram.enabled) {
		adapters.push(createTelegramAdapter({ ...common, ...config.adapters.telegram }));
	}
	if (config.adapters.feishu.enabled) {
		adapters.push(createFeishuAdapter({
			...common,
			...config.adapters.feishu,
			http: config.http
		}));
	}
	if (config.adapters.lark?.enabled) {
		// Same open platform as Feishu, international edition.
		adapters.push(createFeishuAdapter({
			...common,
			...config.adapters.lark,
			baseUrl: 'https://open.larksuite.com',
			http: config.http
		}));
	}
	if (config.adapters.wecom.enabled) {
		adapters.push(createWecomAdapter({
			...common,
			...config.adapters.wecom,
			http: config.http
		}));
	}
	if (config.adapters.mock?.enabled) {
		adapters.push(createMockAdapter({ ...common, ...config.adapters.mock }));
	}
	return adapters;
}
