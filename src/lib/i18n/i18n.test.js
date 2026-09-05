import { describe, expect, it } from 'vitest';
import { DICTIONARY, LOCALES, detectLocale, t, translator, validateDictionary } from './index.js';

describe('detectLocale', () => {
	it('honours a stored choice above browser preferences', () => {
		expect(detectLocale({ stored: 'ru', preferred: ['en-US'] })).toBe('ru');
	});

	it('matches region subtags to their base locale', () => {
		expect(detectLocale({ preferred: ['uz-Latn-UZ', 'en'] })).toBe('uz');
	});

	it('falls back to English for unsupported languages', () => {
		expect(detectLocale({ preferred: ['de-DE', 'fr'] })).toBe('en');
		expect(detectLocale({ stored: 'kl' })).toBe('en');
		expect(detectLocale()).toBe('en');
	});
});

describe('t', () => {
	it('translates known keys per locale', () => {
		expect(t('nav.buy', 'uz')).toBe('Xarid qilish');
		expect(t('nav.buy', 'ru')).toBe('\u041a\u0443\u043f\u0438\u0442\u044c');
	});

	it('falls back to English rather than showing a raw key', () => {
		const partial = { 'x.y': { en: 'Only English' } };
		expect(t('nav.buy', 'de')).toBe('Buy');
		expect(partial['x.y'].en).toBe('Only English');
	});

	it('returns the key itself when nothing is defined', () => {
		expect(t('does.not.exist', 'en')).toBe('does.not.exist');
	});

	it('interpolates placeholders', () => {
		const dict = { greet: { en: 'Hi {name}' } };
		DICTIONARY.greet = dict.greet;
		expect(t('greet', 'en', { name: 'Avazbek' })).toBe('Hi Avazbek');
		expect(t('greet', 'en', {})).toBe('Hi {name}');
		delete DICTIONARY.greet;
	});

	it('binds a locale via translator()', () => {
		const tt = translator('uz');
		expect(tt('nav.specs')).toBe('Xususiyatlar');
	});
});

describe('validateDictionary', () => {
	it('passes for the shipped dictionary: no locale may lag behind', () => {
		expect(validateDictionary()).toEqual({ ok: true, missing: [], empty: [] });
	});

	it('reports missing and empty translations', () => {
		const report = validateDictionary({
			'a.b': { en: 'A', uz: '' },
			'c.d': { en: 'C', uz: 'C', ru: 'C' }
		});
		expect(report.ok).toBe(false);
		expect(report.missing).toContain('a.b:ru');
		expect(report.empty).toContain('a.b:uz');
	});

	it('ships exactly the three advertised locales', () => {
		expect(LOCALES.map((entry) => entry.code)).toEqual(['en', 'uz', 'ru']);
	});
});
