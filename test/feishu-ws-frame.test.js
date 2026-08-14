// Round-trip tests for the minimal protobuf Frame codec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFrame, decodeFrame, headerMap, payloadJson } from '../lib/adapters/feishu-ws-frame.js';

test('round-trips a full event frame', () => {
	const payload = JSON.stringify({ schema: '2.0', header: { event_type: 'im.message.receive_v1' } });
	const frame = {
		seqID: 123n,
		logID: 456n,
		service: 77,
		method: 1,
		headers: [
			{ key: 'type', value: 'event' },
			{ key: 'message_id', value: 'om_test123' },
			{ key: 'timestamp', value: '1699999999000' }
		],
		payloadType: 'json',
		payload: Buffer.from(payload, 'utf8')
	};
	const encoded = encodeFrame(frame);
	const decoded = decodeFrame(encoded);
	assert.equal(decoded.seqID, 123n);
	assert.equal(decoded.logID, 456n);
	assert.equal(decoded.service, 77);
	assert.equal(decoded.method, 1);
	assert.deepEqual(headerMap(decoded), { type: 'event', message_id: 'om_test123', timestamp: '1699999999000' });
	assert.deepEqual(payloadJson(decoded), { schema: '2.0', header: { event_type: 'im.message.receive_v1' } });
});

test('round-trips a ping control frame (no payload)', () => {
	const encoded = encodeFrame({
		seqID: 0,
		logID: 0,
		service: 42,
		method: 0,
		headers: [{ key: 'type', value: 'ping' }]
	});
	const decoded = decodeFrame(encoded);
	assert.equal(decoded.seqID, 0n);
	assert.equal(decoded.service, 42);
	assert.equal(decoded.method, 0);
	assert.deepEqual(headerMap(decoded), { type: 'ping' });
	assert.equal(decoded.payload, undefined);
});

test('tolerates unknown fields on decode', () => {
	const known = encodeFrame({ seqID: 7n, logID: 0n, service: 1, method: 0, headers: [] });
	// Append an unknown varint field (field 99, wire type 0).
	const tail = Buffer.from([(99 << 3) | 0, 0x2a]);
	const combined = Buffer.concat([known, tail]);
	const decoded = decodeFrame(combined);
	assert.equal(decoded.seqID, 7n);
});

test('handles large varints (uint64)', () => {
	const encoded = encodeFrame({ seqID: 0xFFFFFFFFFFFFFFFFn, logID: 0n, service: 1, method: 1, headers: [] });
	const decoded = decodeFrame(encoded);
	assert.equal(decoded.seqID, 0xFFFFFFFFFFFFFFFFn);
});
