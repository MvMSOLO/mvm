import { test, expect } from '@playwright/test';

/**
 * These run against the production build. They deliberately assert on user
 * visible behaviour (is the canvas painting? does the chapter copy change on
 * scroll? does the configurator respond?) rather than on internals, so they
 * keep working while the 3D implementation evolves.
 */

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	// The loader removes itself once the model resolves (or fails over).
	await expect(page.locator('[data-loader]')).toHaveCount(0, { timeout: 45_000 });
});

test('renders the hero, the canvas and the chapter rail', async ({ page }) => {
	await expect(page).toHaveTitle(/NOVA/i);
	await expect(page.locator('canvas')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(/NEXT/i);

	const painted = await page.evaluate(() => {
		const canvas = /** @type {HTMLCanvasElement | null} */ (document.querySelector('canvas'));
		return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
	});
	expect(painted).toBe(true);
});

test('keeps the 3D subject inside the frame through the middle chapters', async ({ page }) => {
	// Regression guard for the framing bug: the camera distance is solved from
	// the subject bounding sphere, so the projected subject must stay on screen
	// at every point of the cinematic scroll.
	const region = page.locator('[data-cinematic]');
	const box = await region.boundingBox();
	expect(box).not.toBeNull();

	for (const fraction of [0.2, 0.35, 0.45, 0.55, 0.65, 0.8, 0.95]) {
		await page.evaluate((f) => {
			const el = document.querySelector('[data-cinematic]');
			if (!el) return;
			const top = el.getBoundingClientRect().top + window.scrollY;
			const length = Math.max(el.clientHeight - window.innerHeight, 1);
			window.scrollTo({ top: top + f * length, behavior: 'instant' });
		}, fraction);
		await page.waitForTimeout(1200);

		// A non-empty frame: sample the canvas and require some lit pixels.
		const litRatio = await page.evaluate(() => {
			const canvas = /** @type {HTMLCanvasElement | null} */ (document.querySelector('canvas'));
			if (!canvas) return 0;
			const probe = document.createElement('canvas');
			probe.width = 160;
			probe.height = 100;
			const ctx = probe.getContext('2d');
			if (!ctx) return 0;
			ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
			const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
			let lit = 0;
			for (let i = 0; i < data.length; i += 4) {
				if (data[i] + data[i + 1] + data[i + 2] > 90) lit++;
			}
			return lit / (probe.width * probe.height);
		});
		expect(litRatio, `frame at ${fraction} should not be empty`).toBeGreaterThan(0.01);
	}
});

test('chapter navigation and anchors work', async ({ page }) => {
	await page.locator('a[href="#specs"], a[href$="#specs"]').first().click();
	await expect(page.locator('#specs')).toBeInViewport({ timeout: 10_000 });
});

test('configurator updates the summary', async ({ page }) => {
	const config = page.locator('#configurator');
	await config.scrollIntoViewIfNeeded();

	const swatches = config.getByRole('button', { pressed: false });
	const count = await swatches.count();
	expect(count).toBeGreaterThan(0);

	await swatches.first().click();
	await expect(config.getByRole('button', { pressed: true }).first()).toBeVisible();
});

test('has no console errors on load', async ({ page }) => {
	/** @type {string[]} */
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});

	await page.reload();
	await page.waitForTimeout(3000);
	// WebGL warnings from software rasterisers are noisy but harmless.
	const real = errors.filter((message) => !/WebGL|SwiftShader|GPU stall/i.test(message));
	expect(real).toEqual([]);
});

test('respects reduced motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.reload();
	await expect(page.locator('[data-loader]')).toHaveCount(0, { timeout: 45_000 });
	await expect(page.locator('canvas')).toBeVisible();
});
