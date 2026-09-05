import { writable, derived } from 'svelte/store';
import { DEFAULT_LOCALE, detectLocale, isLocale, translator } from './index.js';

const STORAGE_KEY = 'nova-one:locale';

/** Active locale. SSR always starts at the default so markup is deterministic. */
export const locale = writable(/** @type {string} */ (DEFAULT_LOCALE));

/** `$tr('nav.buy')` in components. */
export const tr = derived(locale, ($locale) => translator($locale));

/**
 * Adopt the visitor's locale on the client: a previous explicit choice wins,
 * otherwise the browser languages decide.
 * @returns {string}
 */
export function initLocale() {
	if (typeof window === 'undefined') return DEFAULT_LOCALE;
	let stored = null;
	try {
		stored = window.localStorage?.getItem(STORAGE_KEY);
	} catch {
		stored = null;
	}
	const next = detectLocale({
		stored,
		preferred: [...(navigator.languages ?? []), navigator.language ?? '']
	});
	locale.set(next);
	if (document?.documentElement) document.documentElement.lang = next;
	return next;
}

/**
 * Change locale and remember it.
 * @param {string} code
 */
export function setLocale(code) {
	if (!isLocale(code)) return;
	locale.set(code);
	if (typeof window === 'undefined') return;
	try {
		window.localStorage?.setItem(STORAGE_KEY, code);
	} catch {
		// Private mode: the choice simply does not persist.
	}
	if (document?.documentElement) document.documentElement.lang = code;
}
