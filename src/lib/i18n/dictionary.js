/**
 * Interface copy, one entry per key, three locales.
 *
 * This file is the *content layer*: it is the only place UI strings exist, it
 * is validated in CI (`npm run content`) so a locale can never silently drift,
 * and it is plain data so a headless CMS can generate it verbatim. Chapter and
 * spec copy lives in `src/lib/data/product.js` for the same reason.
 *
 * @type {Record<string, Record<string, string>>}
 */
export const DICTIONARY = {
	'nav.overview': { en: 'Overview', uz: 'Umumiy', ru: 'Обзор' },
	'nav.design': { en: 'Design', uz: 'Dizayn', ru: 'Дизайн' },
	'nav.specs': { en: 'Specs', uz: 'Xususiyatlar', ru: 'Характеристики' },
	'nav.gallery': { en: 'Gallery', uz: 'Galereya', ru: 'Галерея' },
	'nav.buy': { en: 'Buy', uz: 'Xarid qilish', ru: 'Купить' },
	'cta.preorder': { en: 'Pre-order', uz: 'Buyurtma berish', ru: 'Предзаказ' },
	'cta.explore': { en: 'Explore the device', uz: 'Qurilmani koʻrish', ru: 'Изучить устройство' },
	'ar.view': { en: 'View in your space', uz: 'Oʻz makoningizda koʻrish', ru: 'Посмотреть у себя' },
	'ar.preparing': { en: 'Preparing AR…', uz: 'AR tayyorlanmoqda…', ru: 'Подготовка AR…' },
	'ar.unsupported': {
		en: 'AR needs an iPhone, iPad or Android phone',
		uz: 'AR uchun iPhone, iPad yoki Android telefon kerak',
		ru: 'Для AR нужен iPhone, iPad или Android'
	},
	'loader.title': { en: 'NOVA ONE', uz: 'NOVA ONE', ru: 'NOVA ONE' },
	'loader.hint': {
		en: 'Calibrating optics',
		uz: 'Optika kalibrlanmoqda',
		ru: 'Калибровка оптики'
	},
	'scroll.hint': { en: 'Scroll to explore', uz: 'Koʻrish uchun aylantiring', ru: 'Прокрутите' },
	'config.finish': { en: 'Finish', uz: 'Rang', ru: 'Цвет' },
	'config.storage': { en: 'Storage', uz: 'Xotira', ru: 'Память' },
	'quality.label': { en: 'Quality', uz: 'Sifat', ru: 'Качество' },
	'lang.label': { en: 'Language', uz: 'Til', ru: 'Язык' },
	'footer.rights': {
		en: 'Concept device. Not a shipping product.',
		uz: 'Konsept qurilma. Sotuvdagi mahsulot emas.',
		ru: 'Концепт. Не серийный продукт.'
	}
};

/** Locales the site ships, in menu order. */
export const LOCALES = /** @type {const} */ ([
	{ code: 'en', label: 'English', dir: 'ltr' },
	{ code: 'uz', label: 'Oʻzbekcha', dir: 'ltr' },
	{ code: 'ru', label: 'Русский', dir: 'ltr' }
]);

export const DEFAULT_LOCALE = 'en';
