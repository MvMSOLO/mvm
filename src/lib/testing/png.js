/**
 * Minimal PNG reader/writer for the visual-regression job.
 *
 * Playwright hands us PNG bytes and the diff needs raw RGBA, so something has
 * to decode. Rather than add a native image dependency to CI, this decodes the
 * subset PNG that screenshots actually use: 8-bit truecolour, with or without
 * alpha, non-interlaced. Anything else throws loudly instead of guessing.
 */
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * @param {Uint8Array} bytes
 * @returns {{ width: number, height: number, data: Uint8Array }} RGBA pixels.
 */
export function decodePng(bytes) {
	for (let i = 0; i < SIGNATURE.length; i += 1) {
		if (bytes[i] !== SIGNATURE[i]) throw new Error('not a PNG');
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 8;
	let width = 0;
	let height = 0;
	let channels = 4;
	/** @type {Uint8Array[]} */
	const idat = [];

	while (offset < bytes.length) {
		const length = view.getUint32(offset);
		const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
		const body = bytes.subarray(offset + 8, offset + 8 + length);

		if (type === 'IHDR') {
			width = view.getUint32(offset + 8);
			height = view.getUint32(offset + 12);
			const depth = body[8];
			const colorType = body[9];
			const interlace = body[12];
			if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
			if (interlace !== 0) throw new Error('interlaced PNG is not supported');
			if (colorType === 2) channels = 3;
			else if (colorType === 6) channels = 4;
			else throw new Error(`unsupported colour type ${colorType}`);
		} else if (type === 'IDAT') {
			idat.push(body);
		} else if (type === 'IEND') {
			break;
		}

		offset += 12 + length;
	}

	const raw = new Uint8Array(inflateSync(Buffer.concat(idat.map((part) => Buffer.from(part)))));
	const stride = width * channels;
	const out = new Uint8Array(width * height * 4);
	const line = new Uint8Array(stride);
	const previous = new Uint8Array(stride);

	let source = 0;
	for (let y = 0; y < height; y += 1) {
		const filter = raw[source];
		source += 1;
		line.set(raw.subarray(source, source + stride));
		source += stride;
		unfilter(filter, line, previous, channels);

		for (let x = 0; x < width; x += 1) {
			const from = x * channels;
			const to = (y * width + x) * 4;
			out[to] = line[from];
			out[to + 1] = line[from + 1];
			out[to + 2] = line[from + 2];
			out[to + 3] = channels === 4 ? line[from + 3] : 255;
		}
		previous.set(line);
	}

	return { width, height, data: out };
}

/**
 * Reverse one PNG scanline filter, in place.
 * @param {number} filter
 * @param {Uint8Array} line
 * @param {Uint8Array} previous
 * @param {number} bpp Bytes per pixel.
 */
function unfilter(filter, line, previous, bpp) {
	if (filter === 0) return;
	for (let i = 0; i < line.length; i += 1) {
		const left = i >= bpp ? line[i - bpp] : 0;
		const up = previous[i];
		const upLeft = i >= bpp ? previous[i - bpp] : 0;
		if (filter === 1) line[i] = (line[i] + left) & 0xff;
		else if (filter === 2) line[i] = (line[i] + up) & 0xff;
		else if (filter === 3) line[i] = (line[i] + ((left + up) >> 1)) & 0xff;
		else if (filter === 4) line[i] = (line[i] + paeth(left, up, upLeft)) & 0xff;
		else throw new Error(`unknown PNG filter ${filter}`);
	}
}

/**
 * @param {number} a Left.
 * @param {number} b Up.
 * @param {number} c Up-left.
 * @returns {number}
 */
function paeth(a, b, c) {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	return pb <= pc ? b : c;
}

const CRC_TABLE = (() => {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c;
	}
	return table;
})();

/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function crc32(bytes) {
	let c = 0xffffffff;
	for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

/**
 * Write RGBA pixels as a PNG. Used for the diff artefacts CI uploads.
 *
 * @param {Uint8Array} rgba
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function encodePng(rgba, width, height) {
	const stride = width * 4;
	const raw = new Uint8Array((stride + 1) * height);
	for (let y = 0; y < height; y += 1) {
		raw[y * (stride + 1)] = 0; // filter: none
		raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
	}

	/**
	 * @param {string} type
	 * @param {Uint8Array} body
	 * @returns {Buffer}
	 */
	const chunk = (type, body) => {
		const head = Buffer.alloc(8);
		head.writeUInt32BE(body.length, 0);
		head.write(type, 4, 'ascii');
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(body)])), 0);
		return Buffer.concat([head, Buffer.from(body), crc]);
	};

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // RGBA

	return new Uint8Array(
		Buffer.concat([
			Buffer.from(SIGNATURE),
			chunk('IHDR', ihdr),
			chunk('IDAT', new Uint8Array(deflateSync(Buffer.from(raw)))),
			chunk('IEND', new Uint8Array(0))
		])
	);
}
