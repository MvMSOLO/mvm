#!/usr/bin/env node
/**
 * Performance budget gate.
 *
 * "100x faster" only means something if a number enforces it, so the build
 * fails when the shipped bytes grow past these limits. Sizes are brotli-ish
 * (gzip is used as the portable proxy) because that is what users download.
 *
 * Run: node scripts/check-budget.mjs [buildDir]
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUILD_DIR = process.argv[2] ?? 'build';

/** Budgets in KB of gzipped bytes. */
const BUDGETS = {
	/** Everything the browser must parse before first paint of the page shell. */
	entryJs: 120,
	/** All JS in the build, including the lazily loaded three.js chunks. */
	totalJs: 400,
	/** All CSS. */
	totalCss: 20,
	/** The 3D model. */
	model: 1700,
	/** Self-hosted fonts (latin + latin-ext subsets only). */
	fonts: 200
};

/** @param {string} dir @returns {string[]} */
function walk(dir) {
	/** @type {string[]} */
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

/** @param {string} file */
function gzipKb(file) {
	const raw = readFileSync(file);
	// Already-compressed payloads are counted as-is; gzipping them again lies.
	const compressed = /\.(woff2|glb|png|jpg|webp|avif)$/.test(file) ? raw : gzipSync(raw);
	return compressed.length / 1024;
}

let files;
try {
	files = walk(BUILD_DIR);
} catch {
	console.error(`budget: no build found at ${BUILD_DIR} - run \`npm run build\` first.`);
	process.exit(1);
}

const measured = {
	entryJs: 0,
	totalJs: 0,
	totalCss: 0,
	model: 0,
	fonts: 0
};

for (const file of files) {
	const ext = extname(file);
	const size = gzipKb(file);

	if (ext === '.js') {
		measured.totalJs += size;
		// SvelteKit names the boot chunks `entry/*` and `chunks/*`; the three.js and
		// post-processing code lands in separate lazy chunks, which is the whole
		// point of the split and is therefore not charged to the entry budget.
		const rel = relative(BUILD_DIR, file).replace(/\\/g, '/');
		if (rel.includes('/entry/') || /(^|\/)start\.[^/]+\.js$/.test(rel)) measured.entryJs += size;
	} else if (ext === '.css') measured.totalCss += size;
	else if (ext === '.glb') measured.model += size;
	else if (ext === '.woff2') measured.fonts += size;
}

let failed = false;
console.log(`Performance budget (${BUILD_DIR})`);
for (const [key, limit] of Object.entries(BUDGETS)) {
	const value = measured[key];
	const ok = value <= limit;
	if (!ok) failed = true;
	console.log(
		`  ${ok ? 'ok  ' : 'FAIL'} ${key.padEnd(9)} ${value.toFixed(1).padStart(7)} KB / ${limit} KB`
	);
}

if (failed) {
	console.error('\nBudget exceeded. Either optimise, or raise the limit deliberately.');
	process.exit(1);
}
console.log('\nAll budgets met.');
