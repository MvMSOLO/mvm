// Content-layer gate.
//
// The site's copy lives in two plain-data modules (`src/lib/i18n/dictionary.js`
// for interface strings, `src/lib/data/product.js` for chapters and specs).
// That is the whole "CMS": editable without touching components, reviewable in
// a pull request, and validated here so a half-translated or structurally
// broken edit fails CI instead of shipping.
import { validateDictionary, LOCALES } from '../src/lib/i18n/index.js';
import { CHAPTERS, LAYERS, SPECS } from '../src/lib/data/product.js';

const problems = [];

// 1. Every interface string exists in every shipped locale.
const dictionary = validateDictionary();
for (const key of dictionary.missing) problems.push(`missing translation ${key}`);
for (const key of dictionary.empty) problems.push(`empty translation ${key}`);

// 2. Chapters: unique ids, contiguous scroll ranges, required fields.
const ids = new Set();
let previousEnd = 0;
for (const chapter of CHAPTERS) {
	for (const field of ['id', 'rail', 'badge', 'title', 'body', 'accent']) {
		if (!chapter[field]) problems.push(`chapter ${chapter.id ?? '?'} is missing ${field}`);
	}
	if (ids.has(chapter.id)) problems.push(`duplicate chapter id ${chapter.id}`);
	ids.add(chapter.id);

	if (!(chapter.end > chapter.start)) {
		problems.push(`chapter ${chapter.id} has an empty scroll range`);
	}
	if (Math.abs(chapter.start - previousEnd) > 1e-6) {
		problems.push(
			`chapter ${chapter.id} leaves a scroll gap: starts at ${chapter.start}, previous ended at ${previousEnd}`
		);
	}
	previousEnd = chapter.end;
}
if (Math.abs(previousEnd - 1) > 1e-6) {
	problems.push(`chapters cover ${previousEnd} of the scroll range, expected 1`);
}

// 3. Exploded-view layers and spec groups must not be empty shells.
for (const layer of LAYERS) {
	if (!layer.key || !layer.name || !layer.num)
		problems.push(`layer ${layer.key ?? '?'} incomplete`);
}
for (const spec of SPECS) {
	if (!spec.value || !spec.label) problems.push(`spec ${spec.label ?? '?'} is incomplete`);
}

console.log(
	`Content check: ${CHAPTERS.length} chapters, ${LAYERS.length} layers, ` +
		`${SPECS.length} specs, ${LOCALES.length} locales`
);

if (problems.length) {
	console.error('\nContent problems:');
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}

console.log('Content layer is complete and consistent.');
