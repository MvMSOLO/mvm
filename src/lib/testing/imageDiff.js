/**
 * Pixel comparison for visual-regression testing.
 *
 * Written from scratch (no pixelmatch dependency) so CI needs nothing beyond
 * Node: it takes two decoded RGBA buffers, ignores imperceptible differences,
 * and reports the share of pixels that actually changed. Anti-aliasing and
 * film grain are the reason for the per-channel threshold — a WebGL render is
 * never bit-identical between runs, so a naive equality check would fail
 * every time and teach everyone to ignore the job.
 */

/**
 * @typedef {object} DiffResult
 * @property {number} changed      Number of differing pixels.
 * @property {number} total        Total pixels compared.
 * @property {number} ratio        changed / total, 0..1.
 * @property {boolean} pass        ratio <= tolerance.
 * @property {Uint8Array} [mask]   RGBA highlight of the differences.
 */

/**
 * @param {Uint8Array | Uint8ClampedArray} a RGBA pixels.
 * @param {Uint8Array | Uint8ClampedArray} b RGBA pixels.
 * @param {object} [options]
 * @param {number} [options.threshold] Per-channel delta treated as equal (0..255).
 * @param {number} [options.tolerance] Allowed share of differing pixels (0..1).
 * @param {boolean} [options.mask] Produce a diff image.
 * @returns {DiffResult}
 */
export function comparePixels(a, b, { threshold = 12, tolerance = 0.002, mask = false } = {}) {
	if (a.length !== b.length) {
		throw new Error(`size mismatch: ${a.length} vs ${b.length} bytes`);
	}
	const total = Math.floor(a.length / 4);
	const out = mask ? new Uint8Array(a.length) : undefined;
	let changed = 0;

	for (let i = 0; i < a.length; i += 4) {
		const dr = Math.abs(a[i] - b[i]);
		const dg = Math.abs(a[i + 1] - b[i + 1]);
		const db = Math.abs(a[i + 2] - b[i + 2]);
		const da = Math.abs(a[i + 3] - b[i + 3]);
		const differs = Math.max(dr, dg, db, da) > threshold;
		if (differs) changed += 1;
		if (out) {
			if (differs) {
				out[i] = 255;
				out[i + 1] = 0;
				out[i + 2] = 90;
				out[i + 3] = 255;
			} else {
				// Dim the unchanged image so differences pop in review.
				out[i] = a[i] * 0.25;
				out[i + 1] = a[i + 1] * 0.25;
				out[i + 2] = a[i + 2] * 0.25;
				out[i + 3] = 255;
			}
		}
	}

	const ratio = total === 0 ? 0 : changed / total;
	return { changed, total, ratio, pass: ratio <= tolerance, ...(out ? { mask: out } : {}) };
}

/**
 * Summarise a set of per-shot results for a CI log.
 *
 * @param {Array<{ name: string, result: DiffResult | null, error?: string }>} shots
 * @returns {{ pass: boolean, lines: string[], failures: string[] }}
 */
export function summarise(shots) {
	/** @type {string[]} */
	const lines = [];
	/** @type {string[]} */
	const failures = [];
	for (const shot of shots) {
		if (shot.error || !shot.result) {
			failures.push(shot.name);
			lines.push(`  fail ${shot.name.padEnd(24)} ${shot.error ?? 'no result'}`);
			continue;
		}
		const percent = (shot.result.ratio * 100).toFixed(3);
		if (!shot.result.pass) failures.push(shot.name);
		lines.push(
			`  ${shot.result.pass ? 'ok  ' : 'fail'} ${shot.name.padEnd(24)} ${percent}% changed`
		);
	}
	return { pass: failures.length === 0, lines, failures };
}
