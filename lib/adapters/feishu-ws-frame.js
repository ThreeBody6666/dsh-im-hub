// Minimal protobuf wire-format encoder/decoder for the Feishu long-connection
// `pbbp2.Frame` message. Only the two messages we need are supported; unknown
// fields are skipped, and missing/extra fields are tolerated on decode.
//
// The schema (from lark-oapi SDK `pbbp2.proto`):
//   message Header { string key = 1; string value = 2; }
//   message Frame {
//     uint64 SeqID          = 1;   // varint
//     uint64 LogID          = 2;   // varint
//     int32  service        = 3;   // varint
//     int32  method         = 4;   // varint   (0 = control, 1 = data)
//     repeated Header headers = 5; // length-delimited
//     string payload_encoding = 6; // length-delimited
//     string payload_type     = 7; // length-delimited
//     bytes  payload          = 8; // length-delimited
//     string LogIDNew         = 9; // length-delimited
//   }

const WIRE_VARINT = 0;
const WIRE_LEN = 2;

/** Encode a varint into `out` starting at `offset`; returns bytes written. */
function putVarint(out, offset, value) {
	let v = BigInt(value);
	let i = offset;
	do {
		let byte = Number(v & 0x7fn);
		v >>= 7n;
		if (v !== 0n) byte |= 0x80;
		out[i++] = byte;
	} while (v !== 0n);
	return i - offset;
}

/** Encode a length-delimited field tag + bytes. */
function putLenField(out, offset, field, bytes) {
	let i = offset;
	i += putVarint(out, i, (BigInt(field) << 3n) | BigInt(WIRE_LEN));
	i += putVarint(out, i, bytes.length);
	bytes.forEach((b, j) => { out[i + j] = b; });
	return i + bytes.length;
}

/** Encode a varint field. */
function putVarintField(out, offset, field, value) {
	let i = offset;
	i += putVarint(out, i, (BigInt(field) << 3n) | BigInt(WIRE_VARINT));
	i += putVarint(out, i, value);
	return i;
}

/**
 * Encode a Frame to a Buffer.
 * @param frame - { seqID, logID, service, method, headers, payloadEncoding, payloadType, payload, logIDNew }.
 * @returns a Buffer of the protobuf message.
 */
export function encodeFrame(frame) {
	const headers = (frame.headers ?? []).map((h) => {
		const inner = Buffer.alloc(64 + h.key.length + h.value.length);
		let p = 0;
		p = putLenField(inner, p, 1, Buffer.from(h.key, 'utf8'));
		p = putLenField(inner, p, 2, Buffer.from(h.value, 'utf8'));
		return inner.subarray(0, p);
	});
	const payloadBytes = frame.payload === undefined ? null : (typeof frame.payload === 'string' ? Buffer.from(frame.payload, 'utf8') : frame.payload);
	const estimate = 64 + headers.reduce((n, h) => n + h.length + 8, 0) + (payloadBytes?.length ?? 0) + 32;
	const out = Buffer.alloc(estimate);
	let o = 0;
	o = putVarintField(out, o, 1, frame.seqID ?? 0);
	o = putVarintField(out, o, 2, frame.logID ?? 0);
	o = putVarintField(out, o, 3, frame.service ?? 0);
	o = putVarintField(out, o, 4, frame.method ?? 0);
	for (const h of headers) o = putLenField(out, o, 5, h);
	if (frame.payloadEncoding !== undefined) o = putLenField(out, o, 6, Buffer.from(frame.payloadEncoding, 'utf8'));
	if (frame.payloadType !== undefined) o = putLenField(out, o, 7, Buffer.from(frame.payloadType, 'utf8'));
	if (payloadBytes !== null) o = putLenField(out, o, 8, payloadBytes);
	if (frame.logIDNew !== undefined) o = putLenField(out, o, 9, Buffer.from(frame.logIDNew, 'utf8'));
	return out.subarray(0, o);
}

class Reader {
	constructor(buf) {
		this.buf = buf;
		this.pos = 0;
	}
	get eof() { return this.pos >= this.buf.length; }
	varint() {
		let result = 0n;
		let shift = 0;
		for (;;) {
			if (this.pos >= this.buf.length) throw new Error('unexpected EOF in varint');
			const b = this.buf[this.pos++];
			result |= BigInt(b & 0x7f) << BigInt(shift);
			if (b < 0x80) break;
			shift += 7;
			if (shift > 63) throw new Error('varint too long');
		}
		return result;
	}
	bytes() {
		const len = Number(this.varint());
		if (this.pos + len > this.buf.length) throw new Error('unexpected EOF in length-delimited field');
		const out = this.buf.subarray(this.pos, this.pos + len);
		this.pos += len;
		return out;
	}
	skip(wireType) {
		switch (wireType) {
			case WIRE_VARINT:
				this.varint();
				break;
			case WIRE_LEN:
				this.bytes();
				break;
			case 1:
				this.pos += 8;
				break;
			case 5:
				this.pos += 4;
				break;
			default:
				throw new Error(`unsupported wire type ${wireType}`);
		}
	}
}

/** Decode a Buffer into a Frame object. */
export function decodeFrame(buf) {
	const reader = new Reader(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
	const frame = { seqID: 0n, logID: 0n, service: 0, method: 0, headers: [], payload: undefined };
	while (!reader.eof) {
		const tag = reader.varint();
		const field = Number(tag >> 3n);
		const wireType = Number(tag & 0x7n);
		if (field === 0) break;
		switch (field) {
			case 1:
				frame.seqID = reader.varint();
				break;
			case 2:
				frame.logID = reader.varint();
				break;
			case 3:
				frame.service = Number(reader.varint());
				break;
			case 4:
				frame.method = Number(reader.varint());
				break;
			case 5: {
				const bytes = reader.bytes();
				const sub = new Reader(bytes);
				const header = { key: '', value: '' };
				while (!sub.eof) {
					const t = sub.varint();
					const f = Number(t >> 3n);
					const w = Number(t & 0x7n);
					if (f === 1) header.key = sub.bytes().toString('utf8');
					else if (f === 2) header.value = sub.bytes().toString('utf8');
					else sub.skip(w);
				}
				frame.headers.push(header);
				break;
			}
			case 6:
				frame.payloadEncoding = reader.bytes().toString('utf8');
				break;
			case 7:
				frame.payloadType = reader.bytes().toString('utf8');
				break;
			case 8:
				frame.payload = Buffer.from(reader.bytes());
				break;
			case 9:
				frame.logIDNew = reader.bytes().toString('utf8');
				break;
			default:
				reader.skip(wireType);
		}
	}
	return frame;
}

/** Convenience: header map from a decoded frame. */
export function headerMap(frame) {
	const map = {};
	for (const h of frame.headers ?? []) map[h.key] = h.value;
	return map;
}

/** Convenience: parse the frame payload as JSON (utf8), best-effort. */
export function payloadJson(frame) {
	if (frame.payload === undefined) return undefined;
	try {
		return JSON.parse(frame.payload.toString('utf8'));
	} catch {
		return undefined;
	}
}
