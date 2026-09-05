/**
 * Geometry for the scroll "mini journey": a small route drawn in the corner of
 * the page, with one node per chapter and a marker that travels along it as the
 * visitor scrolls.
 *
 * The maths lives here rather than in the component so the route can be unit
 * tested (monotonic progress, marker never leaving the viewBox, node spacing)
 * without mounting Svelte or measuring a real scroll.
 */

/**
 * @typedef {Object} JourneyNode
 * @property {string} id
 * @property {string} label
 * @property {number} x    SVG x coordinate
 * @property {number} y    SVG y coordinate
 * @property {number} t    progress 0..1 at which this node is reached
 */

/**
 * Lay chapters out along a gentle S-curve inside a viewBox.
 *
 * A straight line would work, but a curve reads as a route on a map, which is
 * the whole point: the visitor should feel they are travelling through the
 * product, not filling a loading bar.
 *
 * @param {{ items: Array<{ id: string, label: string }>, width?: number, height?: number, padding?: number, amplitude?: number }} options
 * @returns {{ nodes: JourneyNode[], path: string, width: number, height: number }}
 */
export function createJourneyRoute(options) {
	const { items, width = 220, height = 64, padding = 14, amplitude = 0.62 } = options;
	const list = Array.isArray(items) ? items : [];
	const span = Math.max(width - padding * 2, 1);
	const midY = height / 2;
	const swing = (height / 2 - padding) * amplitude;

	/** @param {number} t */
	const pointAt = (t) => ({
		x: padding + span * clamp01(t),
		// Two full waves across the route: enough to read as a path, not so much
		// that the marker jitters vertically while scrolling.
		y: midY - Math.sin(clamp01(t) * Math.PI * 2) * swing
	});

	const nodes = list.map((item, index) => {
		const t = list.length > 1 ? index / (list.length - 1) : 0;
		const { x, y } = pointAt(t);
		return { id: item.id, label: item.label, x, y, t };
	});

	// Sample the same function densely for the drawn path so the polyline and the
	// marker can never disagree.
	const samples = 48;
	const path = Array.from({ length: samples + 1 }, (_, i) => {
		const { x, y } = pointAt(i / samples);
		return `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
	}).join(' ');

	return { nodes, path, width, height };
}

/**
 * Marker position and heading at a given scroll progress.
 * @param {{ width?: number, height?: number, padding?: number, amplitude?: number }} route
 * @param {number} progress 0..1
 * @returns {{ x: number, y: number, angle: number }} angle in degrees
 */
export function markerAt(route, progress) {
	const { width = 220, height = 64, padding = 14, amplitude = 0.62 } = route ?? {};
	const span = Math.max(width - padding * 2, 1);
	const midY = height / 2;
	const swing = (height / 2 - padding) * amplitude;
	const t = clamp01(progress);

	const x = padding + span * t;
	const y = midY - Math.sin(t * Math.PI * 2) * swing;
	// Analytic derivative, so the marker tilts into the curve instead of being
	// numerically differenced (which wobbles at the ends).
	const dx = span;
	const dy = -Math.cos(t * Math.PI * 2) * swing * Math.PI * 2;
	const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

	return { x, y, angle };
}

/**
 * Index of the node the traveller has most recently passed.
 * @param {JourneyNode[]} nodes
 * @param {number} progress
 * @returns {number}
 */
export function activeNodeIndex(nodes, progress) {
	if (!nodes?.length) return 0;
	const t = clamp01(progress);
	let index = 0;
	for (let i = 0; i < nodes.length; i++) {
		// Half-step tolerance: a node counts as reached slightly before the marker
		// sits exactly on it, which matches how the section text lands on screen.
		if (t >= nodes[i].t - 0.5 / nodes.length) index = i;
	}
	return index;
}

/** @param {number} value */
function clamp01(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.min(Math.max(value, 0), 1);
}

/** @param {number} value */
function round(value) {
	return Math.round(value * 100) / 100;
}
