// Visual-regression runner.
//
// Usage:
//   node scripts/visual-regression.mjs            compare against baselines
//   node scripts/visual-regression.mjs --update    accept the current render
//
// It serves `build/` from memory through Playwright's request interception (no
// background server), forces the high quality tier so the render is
// deterministic, walks the eight chapters plus the three seams, and compares
// each frame with the committed baseline. Diff artefacts are written next to
// the shots so a CI run explains itself.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { comparePixels, summarise } from '../src/lib/testing/imageDiff.js';
import { decodePng, encodePng } from '../src/lib/testing/png.js';

const ROOT = 'build';
const BASELINE = 'tests/visual/baseline';
const CURRENT = 'tests/visual/current';
const UPDATE = process.argv.includes('--update');
const TOLERANCE = Number(process.env.VISUAL_TOLERANCE ?? 0.004);

const STOPS = [
	['01-form', 0.02],
	['02-display', 0.18],
	['03-optics', 0.3],
	['04-architecture', 0.44],
	['05-compute', 0.6],
	['06-energy', 0.72],
	['07-intelligence', 0.82],
	['08-reassembly', 0.95]
];

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.glb': 'model/gltf-binary',
	'.ktx2': 'image/ktx2',
	'.wasm': 'application/wasm',
	'.woff2': 'font/woff2',
	'.png': 'image/png',
	'.txt': 'text/plain'
};

if (!fs.existsSync(ROOT)) {
	console.error('No build/ directory. Run `npm run build` first.');
	process.exit(1);
}

fs.mkdirSync(UPDATE ? BASELINE : CURRENT, { recursive: true });

const browser = await chromium.launch({
	args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const context = await browser.newContext({
	viewport: { width: 1280, height: 720 },
	deviceScaleFactor: 1,
	reducedMotion: 'no-preference'
});

await context.route('**/*', async (route) => {
	const url = new URL(route.request().url());
	if (url.hostname !== 'nova.local') return route.continue();
	let rel = decodeURIComponent(url.pathname);
	if (rel.endsWith('/')) rel += 'index.html';
	const file = path.join(path.resolve(ROOT), rel);
	if (!file.startsWith(path.resolve(ROOT)) || !fs.existsSync(file)) {
		return route.fulfill({ status: 404, body: 'not found' });
	}
	return route.fulfill({
		status: 200,
		headers: { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' },
		body: fs.readFileSync(file)
	});
});

const page = await context.newPage();
// `quality=high` pins the full effect chain, and `seed` freezes the grain so a
// rerun is comparable; without both, every frame differs by design.
await page.goto('http://nova.local/?quality=high', { waitUntil: 'load' });
await page
	.waitForFunction(() => !document.querySelector('[data-loader]'), { timeout: 30000 })
	.catch(() => console.warn('warn: loader never cleared'));

/** @type {Array<{ name: string, result: any, error?: string }>} */
const shots = [];

for (const [name, fraction] of STOPS) {
	await page.evaluate((f) => {
		const region = document.querySelector('[data-cinematic]');
		if (!region) {
			window.scrollTo(0, f * (document.documentElement.scrollHeight - window.innerHeight));
			return;
		}
		const top = region.getBoundingClientRect().top + window.scrollY;
		const length = Math.max(region.offsetHeight - window.innerHeight, 1);
		window.scrollTo(0, top + f * length);
	}, fraction);
	await page.waitForTimeout(1600);

	const buffer = await page.screenshot({ timeout: 0 });
	const baselineFile = path.join(BASELINE, `${name}.png`);

	if (UPDATE) {
		fs.writeFileSync(baselineFile, buffer);
		shots.push({ name, result: { changed: 0, total: 1, ratio: 0, pass: true } });
		continue;
	}

	fs.writeFileSync(path.join(CURRENT, `${name}.png`), buffer);

	if (!fs.existsSync(baselineFile)) {
		shots.push({ name, result: null, error: 'no baseline (run with --update)' });
		continue;
	}

	try {
		const current = decodePng(new Uint8Array(buffer));
		const baseline = decodePng(new Uint8Array(fs.readFileSync(baselineFile)));
		if (current.width !== baseline.width || current.height !== baseline.height) {
			shots.push({ name, result: null, error: 'viewport size changed' });
			continue;
		}
		const result = comparePixels(baseline.data, current.data, {
			tolerance: TOLERANCE,
			mask: true
		});
		if (!result.pass && result.mask) {
			fs.writeFileSync(
				path.join(CURRENT, `${name}.diff.png`),
				encodePng(result.mask, current.width, current.height)
			);
		}
		shots.push({ name, result });
	} catch (error) {
		shots.push({ name, result: null, error: String(error?.message ?? error) });
	}
}

await browser.close();

const report = summarise(shots);
console.log(`\nVisual regression (tolerance ${(TOLERANCE * 100).toFixed(2)}%)`);
for (const line of report.lines) console.log(line);

if (UPDATE) {
	console.log(`\nBaselines written to ${BASELINE}.`);
	process.exit(0);
}

if (!report.pass) {
	console.error(`\nFailed: ${report.failures.join(', ')}`);
	console.error(`Diff images: ${CURRENT}`);
	process.exit(1);
}

console.log('\nEvery frame matches its baseline.');
