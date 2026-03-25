function fract(value) {
	return value - Math.floor(value);
}

function compareKeyArrays(a, b) {
	for (let i = 0; i < a.length; i++) {
		const diff = a[i] - b[i];
		if (diff !== 0) return diff;
	}
	return 0;
}

function hashCoord(x, y, seed = 0) {
	return fract(Math.sin((x + 1) * 127.1 + (y + 1) * 311.7 + seed * 17.13) * 43758.5453123);
}

function generateRankedField(size, valueFn) {
	const coords = [];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			coords.push({ x, y, value: valueFn(x, y, size) });
		}
	}
	coords.sort((a, b) => compareKeyArrays([a.value, a.y, a.x], [b.value, b.y, b.x]));
	return coords;
}

function ranksFromSortedCoords(coords, size) {
	const ranks = new Uint32Array(size * size);
	coords.forEach((coord, rank) => {
		ranks[coord.y * size + coord.x] = rank;
	});
	return ranks;
}

export function generateBayerRanks(size) {
	const exponent = Math.log2(size);
	const ranks = new Uint32Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let rank = 0;
			for (let bit = 0; bit < exponent; bit++) {
				rank = (rank << 2) | ((2 * (x >> bit) + 3 * ((y >> bit) & 1)) & 3);
			}
			ranks[y * size + x] = rank;
		}
	}
	return ranks;
}

function buildPeriodicCellRanks(period, shape) {
	const center = (period - 1) / 2;
	const coords = [];
	for (let y = 0; y < period; y++) {
		for (let x = 0; x < period; x++) {
			const xOffset = shape === 'circle' && y % 2 === 1 ? 0.5 : 0;
			const dx = x + xOffset - center;
			const dy = y - center;
			const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
			const distance = shape === 'diamond' ? Math.abs(dx) + Math.abs(dy) : Math.hypot(dx, dy) * 0.8;
			coords.push({ x, y, key: [distance, angle, y, x] });
		}
	}
	coords.sort((a, b) => compareKeyArrays(a.key, b.key));
	return ranksFromSortedCoords(coords, period);
}

function buildMacroRanks(count) {
	return ranksFromSortedCoords(
		generateRankedField(count, (x, y) => fract(52.9829189 * fract(0.06711056 * x + 0.00583715 * y))),
		count,
	);
}

function generateRepeatedClusterRanks(size, shape) {
	const targetPeriod = shape === 'diamond' ? 4 : 8;
	const macroCount = Math.max(1, Math.round(size / targetPeriod));
	const period = Math.round(size / macroCount);
	const localRanks = buildPeriodicCellRanks(period, shape);
	const macroRanks = buildMacroRanks(macroCount);
	const coords = [];

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const macroX = Math.floor(x / period);
			const macroY = Math.floor(y / period);
			const localX = x % period;
			const localY = y % period;
			const localRank = localRanks[localY * period + localX];
			const macroRank = macroRanks[macroY * macroCount + macroX];
			coords.push({ x, y, key: [localRank, macroRank, y, x] });
		}
	}

	coords.sort((a, b) => compareKeyArrays(a.key, b.key));
	return ranksFromSortedCoords(coords, size);
}

function generateRepeatedFieldRanks(size, targetPeriod, valueFn) {
	const macroCount = Math.max(1, Math.round(size / targetPeriod));
	const period = Math.round(size / macroCount);
	const localRanks = ranksFromSortedCoords(
		generateRankedField(period, (x, y) => valueFn(x, y, period)),
		period,
	);
	const macroRanks = buildMacroRanks(macroCount);
	const coords = [];

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const macroX = Math.floor(x / period);
			const macroY = Math.floor(y / period);
			const localX = x % period;
			const localY = y % period;
			const localRank = localRanks[localY * period + localX];
			const macroRank = macroRanks[macroY * macroCount + macroX];
			coords.push({ x, y, key: [localRank, macroRank, y, x] });
		}
	}

	coords.sort((a, b) => compareKeyArrays(a.key, b.key));
	return ranksFromSortedCoords(coords, size);
}

export function generateWhiteNoiseRanks(size) {
	return ranksFromSortedCoords(
		generateRankedField(size, (x, y) => hashCoord(x, y, size * 0.61803398875)),
		size,
	);
}

export function generateDiagonalLineRanks(size) {
	const starts = [0];

	(function fill(lo, hi) {
		if (lo > hi) return;
		const mid = (lo + hi + 1) >> 1;
		starts.push(mid);
		fill(lo, mid - 1);
		fill(mid + 1, hi);
	})(1, size - 1);

	const ranks = new Uint32Array(size * size);
	for (let block = 0; block < size; block++) {
		const start = starts[block];
		const base = block * size;
		for (let y = 0; y < size; y++) {
			ranks[y * size + ((start + y) % size)] = base + y;
		}
	}

	return ranks;
}

export const PROCEDURAL_MASK_BUILDERS = {
	bayer: generateBayerRanks,
	halftone: size => generateRepeatedClusterRanks(size, 'circle'),
	'diagonal-lines': generateDiagonalLineRanks,
	'white-noise': generateWhiteNoiseRanks,
	'interleaved-gradient': size =>
		generateRepeatedFieldRanks(
			size,
			8,
			(x, y) => fract(52.9829189 * fract(0.06711056 * x + 0.00583715 * y)),
		),
	diamond: size => generateRepeatedClusterRanks(size, 'diamond'),
};
