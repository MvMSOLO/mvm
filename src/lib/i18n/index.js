import { DEFAULT_LOCALE, DICTIONARY, LOCALES } from './dictionary.js';

export { DEFAULT_LOCALE, DICTIONARY, LOCALES };

/** @typedef {'en' | 'uz' | 'ru'} Locale */

const CODES = LOCALES.map((entry) => entry.code);

/**
 * @param {string | null | undefined} code
 * @returns {boolean}
 */
export function isLocale(code) {
	return typeof code === 'string' && CODES.includes(/** @type {any} */ (code));
}

/**
 * Pick the best locale from an Accept-Language style list or a stored choice.
 * Region subtags are tolerated (`uz-UZ`, `ru-RU`), unknown values fall back.
 *
 * @param {object} [signals]
 * @param {string | null} [signals.stored] Previously chosen locale.
 * @param {string[]} [signals.preferred] navigator.languages / Accept-Language.
 * @returns {Locale}
 */
export function detectLocale({ stored = null, preferred = [] } = {}) {
	if (isLocale(stored)) return /** @type {Locale} */ (stored);
	for (const raw of preferred) {
		const base = String(raw).toLowerCase().split(/[-_;]/)[0];
		if (isLocale(base)) return /** @type {Locale} */ (base);
	}
	return /** @type {Locale} */ (DEFAULT_LOCALE);
}

/**
 * Translate a key. Missing translations fall back to English rather than
 * rendering a raw key, so a half-finished locale still ships a usable page.
 *
 * @param {string} key
 * @param {Locale | string} [locale]
 * @param {Record<string, string | number>} [values] `{name}` placeholders.
 * @returns {string}
 */
export function t(key, locale = DEFAULT_LOCALE, values) {
	const entry = DICTIONARY[key];
	if (!entry) return key;
	const raw = entry[locale] ?? entry[DEFAULT_LOCALE] ?? key;
	if (!values) return raw;
	return raw.replace(/\{(\w+)\}/g, (match, name) =>
		name in values ? String(values[name]) : match
	);
}

/**
 * Bind a translator to one locale, for components.
 * @param {Locale | string} locale
 * @returns {(key: string, values?: Record<string, string | number>) => string}
 */
export function translator(locale) {
	return (key, values) => t(key, locale, values);
}

/**
 * Validate the dictionary: every key must cover every shipped locale, and no
 * value may be empty. This is what makes the content layer CI-checkable.
 *
 * @param {Record<string, Record<string, string>>} [dictionary]
 * @returns {{ ok: boolean, missing: string[], empty: string[] }}
 */
export function validateDictionary(dictionary = DICTIONARY) {
	/** @type {string[]} */
	const missing = [];
	/** @type {string[]} */
	const empty = [];
	for (const [key, entry] of Object.entries(dictionary)) {
		for (const code of CODES) {
			if (!(code in entry)) missing.push(`${key}:${code}`);
			else if (!String(entry[code]).trim()) empty.push(`${key}:${code}`);
		}
	}
	return { ok: missing.length === 0 && empty.length === 0, missing, empty };
}
