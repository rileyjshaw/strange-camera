import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './dither.glsl';
import precomputedMasks from './generated-mask-assets.js';
import { lerp, normalize } from '../util.js';

const CELL_SIZE_MIN = 1;
const CELL_SIZE_MAX = 32;
const CELL_SIZE_INITIAL = 2;
const MASK_SIZE_INITIAL = 8;
const KNOLL_ERROR_FACTOR = 0.8;
const KNOLL_ITERATION_MAX = 1024;
const LUT_AXIS = 12;
const XYZ_WHITE_D65 = [0.95047, 1.0, 1.08883];
const PRECOMPUTED_MASKS = precomputedMasks;
const PLACEHOLDER_MASK_TEXTURE = {
	data: new Uint8Array([0, 0, 0, 255]),
	width: 1,
	height: 1,
};

const STRATEGIES = [
	{ name: 'Bayer', key: 'bayer', maskSizes: [2, 4, 8, 16, 32] },
	{ name: 'Halftone', key: 'halftone', maskSizes: [4, 8, 12, 16, 20, 24] },
	{ name: 'Blue Noise', key: 'blue-noise', maskSizes: PRECOMPUTED_MASKS['blue-noise'].sizes },
	{ name: 'White Noise', key: 'white-noise', maskSizes: [8, 16, 24, 32, 48, 64] },
	{ name: 'Tiled Noise', key: 'tiled-noise', maskSizes: PRECOMPUTED_MASKS['tiled-noise'].sizes },
	{ name: 'IGN', key: 'interleaved-gradient', maskSizes: [4, 8, 16, 24, 32, 48] },
	{ name: 'R-Sequence', key: 'r-sequence', maskSizes: PRECOMPUTED_MASKS['r-sequence'].sizes },
	{ name: 'Diamond', key: 'diamond', maskSizes: [2, 4, 6, 8, 12, 16] },
];

const PALETTES = [
	['222323', 'f0f6f0'],
	['d0d058', 'a0a840', '708028', '405010'],
	['ffffff', 'f42e1f', '2f256b', '060608'],
	['210b1b', '4d222c', '9d654c', 'cfab51'],
	['040c06', '112318', '1e3a29', '305d42', '4d8061', '89a257', 'bedc7f', 'eeffcc'],
	['7c3f58', 'eb6b6f', 'f9a875', 'fff6d3'],
	['daf2e9', '95e0cc', '39707a', '23495d', '1c2638', '9b222b', 'f14e52'],
	['0d2b45', '203c56', '544e68', '8d697a', 'd08159', 'ffaa5e', 'ffd4a3', 'ffecd6'],
	['2176cc', 'ff7d6e', 'fca6ac', 'e8e7cb'],
	['0d101b', '281a2d', '6b2341', 'af2747', 'ee243d'],
	['2d162c', '412752', '683a68', '9775a6'],
	['20284e', '2c4a78', '3875a1', '8bcadd', 'ffffff', 'd6e1e9', 'a7bcc9', '738d9d'],
];

const MASK_TEXTURE_OPTIONS = {
	internalFormat: 'RGBA8',
	format: 'RGBA',
	type: 'UNSIGNED_BYTE',
	minFilter: 'NEAREST',
	magFilter: 'NEAREST',
	wrapS: 'REPEAT',
	wrapT: 'REPEAT',
};

const PALETTE_TEXTURE_OPTIONS = {
	internalFormat: 'RGBA8',
	format: 'RGBA',
	type: 'UNSIGNED_BYTE',
	minFilter: 'NEAREST',
	magFilter: 'NEAREST',
	wrapS: 'CLAMP_TO_EDGE',
	wrapT: 'CLAMP_TO_EDGE',
};

const KNOLL_TEXTURE_OPTIONS = {
	internalFormat: 'R32F',
	format: 'RED',
	type: 'FLOAT',
	minFilter: 'NEAREST',
	magFilter: 'NEAREST',
	wrapS: 'CLAMP_TO_EDGE',
	wrapT: 'CLAMP_TO_EDGE',
};

const lutLabCache = buildLutLabCache();
const proceduralMaskCache = new Map();
const precomputedMaskImageCache = new Map();
const precomputedMaskPromiseCache = new Map();
const paletteDescriptorCache = new Map();
const paletteTextureCache = new Map();
const knollTextureCache = new Map();
const shaderStates = new WeakMap();

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function fract(value) {
	return value - Math.floor(value);
}

function controlToIndex(value, count) {
	return Math.round(clamp(value, 0, 1) * (count - 1));
}

function controlToCellSize(value) {
	return Math.round(lerp(CELL_SIZE_MIN, CELL_SIZE_MAX, clamp(value, 0, 1)));
}

function getMaskSizes(strategyIndex) {
	return STRATEGIES[strategyIndex].maskSizes;
}

function getMaskSize(strategyIndex, value) {
	const maskSizes = getMaskSizes(strategyIndex);
	return maskSizes[controlToIndex(value, maskSizes.length)];
}

function srgbChannelToLinear(value) {
	if (value <= 0.04045) return value / 12.92;
	return ((value + 0.055) / 1.055) ** 2.4;
}

function xyzToLabHelper(value) {
	return value > 216 / 24389 ? Math.cbrt(value) : (841 / 108) * value + 4 / 29;
}

function srgbToLab(rgb) {
	const r = srgbChannelToLinear(rgb[0]);
	const g = srgbChannelToLinear(rgb[1]);
	const b = srgbChannelToLinear(rgb[2]);

	const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / XYZ_WHITE_D65[0];
	const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / XYZ_WHITE_D65[1];
	const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / XYZ_WHITE_D65[2];

	const fx = xyzToLabHelper(x);
	const fy = xyzToLabHelper(y);
	const fz = xyzToLabHelper(z);
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function hyabDistance(a, b) {
	return Math.abs(a[0] - b[0]) + Math.hypot(a[1] - b[1], a[2] - b[2]);
}

function compareKeyArrays(a, b) {
	for (let i = 0; i < a.length; i++) {
		const diff = a[i] - b[i];
		if (diff !== 0) return diff;
	}
	return 0;
}

function hexToRgbBytes(hex) {
	const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
	return [
		parseInt(normalized.slice(0, 2), 16),
		parseInt(normalized.slice(2, 4), 16),
		parseInt(normalized.slice(4, 6), 16),
	];
}

function buildPaletteDescriptor(paletteIndex) {
	const colors = PALETTES[paletteIndex]
		.map(hexToRgbBytes)
		.map(bytes => {
			const srgb = bytes.map(channel => channel / 255);
			return {
				bytes,
				lab: srgbToLab(srgb),
			};
		})
		.sort((a, b) => a.lab[0] - b.lab[0]);

	return { colors };
}

function getPaletteDescriptor(paletteIndex) {
	if (!paletteDescriptorCache.has(paletteIndex)) {
		paletteDescriptorCache.set(paletteIndex, buildPaletteDescriptor(paletteIndex));
	}
	return paletteDescriptorCache.get(paletteIndex);
}

function buildPaletteTexture(paletteIndex) {
	const { colors } = getPaletteDescriptor(paletteIndex);
	const data = new Uint8Array(colors.length * 4);
	colors.forEach((color, index) => {
		const offset = index * 4;
		data[offset] = color.bytes[0];
		data[offset + 1] = color.bytes[1];
		data[offset + 2] = color.bytes[2];
		data[offset + 3] = 255;
	});
	return { data, width: colors.length, height: 1 };
}

function getPaletteTexture(paletteIndex) {
	if (!paletteTextureCache.has(paletteIndex)) {
		paletteTextureCache.set(paletteIndex, buildPaletteTexture(paletteIndex));
	}
	return paletteTextureCache.get(paletteIndex);
}

function getPrecomputedMaskUrl(strategyIndex, size) {
	return PRECOMPUTED_MASKS[STRATEGIES[strategyIndex].key]?.entries[String(size)] ?? null;
}

function loadPrecomputedMaskImage(url) {
	if (precomputedMaskImageCache.has(url)) {
		return Promise.resolve(precomputedMaskImageCache.get(url));
	}
	if (precomputedMaskPromiseCache.has(url)) {
		return precomputedMaskPromiseCache.get(url);
	}

	const promise = new Promise((resolve, reject) => {
		const image = new Image();
		image.decoding = 'async';
		image.onload = () => {
			precomputedMaskImageCache.set(url, image);
			precomputedMaskPromiseCache.delete(url);
			resolve(image);
		};
		image.onerror = () => {
			precomputedMaskPromiseCache.delete(url);
			reject(new Error(`Failed to load mask asset: ${url}`));
		};
		image.src = url;
	});

	precomputedMaskPromiseCache.set(url, promise);
	return promise;
}

function hashCoord(x, y, seed = 0) {
	return fract(Math.sin((x + 1) * 127.1 + (y + 1) * 311.7 + seed * 17.13) * 43758.5453123);
}

function buildPackedMaskTextureFromRanks(ranks, size) {
	const data = new Uint8Array(size * size * 4);
	for (let i = 0; i < ranks.length; i++) {
		const rank = ranks[i];
		const offset = i * 4;
		data[offset] = rank & 0xff;
		data[offset + 1] = (rank >> 8) & 0xff;
		data[offset + 2] = (rank >> 16) & 0xff;
		data[offset + 3] = 255;
	}
	return { data, width: size, height: size };
}

function generateBayerRanks(size) {
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

function generateWhiteNoiseRanks(size) {
	return ranksFromSortedCoords(
		generateRankedField(size, (x, y) => hashCoord(x, y, size * 0.61803398875)),
		size,
	);
}

const PROCEDURAL_MASK_BUILDERS = {
	bayer: generateBayerRanks,
	halftone: size => generateRepeatedClusterRanks(size, 'circle'),
	'white-noise': generateWhiteNoiseRanks,
	'interleaved-gradient': size =>
		generateRepeatedFieldRanks(
			size,
			8,
			(x, y) => fract(52.9829189 * fract(0.06711056 * x + 0.00583715 * y)),
		),
	diamond: size => generateRepeatedClusterRanks(size, 'diamond'),
};

function getProceduralMaskTexture(strategyIndex, size) {
	const key = `${STRATEGIES[strategyIndex].key}:${size}`;
	if (!proceduralMaskCache.has(key)) {
		proceduralMaskCache.set(
			key,
			buildPackedMaskTextureFromRanks(PROCEDURAL_MASK_BUILDERS[STRATEGIES[strategyIndex].key](size), size),
		);
	}
	return proceduralMaskCache.get(key);
}

function getMaskStateKey({ strategyIndex, maskSize }) {
	return `${STRATEGIES[strategyIndex].key}:${maskSize}`;
}

function getImmediateMaskTexture(strategyIndex, size) {
	const url = getPrecomputedMaskUrl(strategyIndex, size);
	if (!url) return getProceduralMaskTexture(strategyIndex, size);
	return precomputedMaskImageCache.get(url) ?? PLACEHOLDER_MASK_TEXTURE;
}

function requestPrecomputedMaskTexture(shader, state) {
	const url = getPrecomputedMaskUrl(state.strategyIndex, state.maskSize);
	if (!url) return;
	const requestedMaskKey = getMaskStateKey(state);
	loadPrecomputedMaskImage(url)
		.then(image => {
			const currentState = shaderStates.get(shader);
			if (!currentState || getMaskStateKey(currentState) !== requestedMaskKey) {
				return;
			}
			shader.updateTextures({ u_mask: image });
		})
		.catch(() => {});
}

function buildLutLabCache() {
	const values = [];
	for (let blue = 0; blue < LUT_AXIS; blue++) {
		for (let green = 0; green < LUT_AXIS; green++) {
			for (let red = 0; red < LUT_AXIS; red++) {
				values.push(srgbToLab([red / (LUT_AXIS - 1), green / (LUT_AXIS - 1), blue / (LUT_AXIS - 1)]));
			}
		}
	}
	return values;
}

function getClosestPaletteIndex(goalLab, paletteLabs) {
	let closestIndex = 0;
	let closestDistance = Infinity;
	for (let i = 0; i < paletteLabs.length; i++) {
		const distance = hyabDistance(goalLab, paletteLabs[i]);
		if (distance < closestDistance) {
			closestDistance = distance;
			closestIndex = i;
		}
	}
	return closestIndex;
}

function buildKnollTexture(paletteIndex, maskSize) {
	const iterationCount = Math.min(maskSize * maskSize, KNOLL_ITERATION_MAX);
	const { colors } = getPaletteDescriptor(paletteIndex);
	const paletteLabs = colors.map(color => color.lab);
	const paletteSize = colors.length;
	const width = LUT_AXIS * LUT_AXIS * paletteSize;
	const height = LUT_AXIS;
	const data = new Float32Array(width * height);

	for (let cellIndex = 0; cellIndex < lutLabCache.length; cellIndex++) {
		const targetLab = lutLabCache[cellIndex];
		const frequency = new Uint16Array(paletteSize);
		const quantError = [0, 0, 0];

		for (let iteration = 0; iteration < iterationCount; iteration++) {
			const goalLab = [
				targetLab[0] + quantError[0] * KNOLL_ERROR_FACTOR,
				targetLab[1] + quantError[1] * KNOLL_ERROR_FACTOR,
				targetLab[2] + quantError[2] * KNOLL_ERROR_FACTOR,
			];
			const closestIndex = getClosestPaletteIndex(goalLab, paletteLabs);
			const closestLab = paletteLabs[closestIndex];
			frequency[closestIndex] += 1;
			quantError[0] += targetLab[0] - closestLab[0];
			quantError[1] += targetLab[1] - closestLab[1];
			quantError[2] += targetLab[2] - closestLab[2];
		}

		const row = Math.floor(cellIndex / (LUT_AXIS * LUT_AXIS));
		const columnBase = (cellIndex % (LUT_AXIS * LUT_AXIS)) * paletteSize;
		let cumulative = 0;
		const rowOffset = row * width;
		for (let paletteOffset = 0; paletteOffset < paletteSize; paletteOffset++) {
			cumulative += frequency[paletteOffset] / iterationCount;
			data[rowOffset + columnBase + paletteOffset] = paletteOffset === paletteSize - 1 ? 1 : cumulative;
		}
	}

	return { data, width, height };
}

function getKnollTexture(paletteIndex, maskSize) {
	const key = `${paletteIndex}:${maskSize}`;
	if (!knollTextureCache.has(key)) {
		knollTextureCache.set(key, buildKnollTexture(paletteIndex, maskSize));
	}
	return knollTextureCache.get(key);
}

function getSceneStateFromControls({ x1, x2, y1, y2 }) {
	const strategyIndex = controlToIndex(x1, STRATEGIES.length);
	return {
		strategyIndex,
		paletteIndex: controlToIndex(x2, PALETTES.length),
		cellSize: controlToCellSize(y1),
		maskSize: getMaskSize(strategyIndex, y2),
	};
}

function syncShader(shader, nextState) {
	const previous = shaderStates.get(shader);
	if (!previous || previous.cellSize !== nextState.cellSize || previous.maskSize !== nextState.maskSize) {
		shader.updateUniforms({
			u_cellSizePx: nextState.cellSize,
			u_maskSize: nextState.maskSize,
		});
	}

	const textureUpdates = {};
	if (!previous || previous.strategyIndex !== nextState.strategyIndex || previous.maskSize !== nextState.maskSize) {
		textureUpdates.u_mask = getImmediateMaskTexture(nextState.strategyIndex, nextState.maskSize);
		requestPrecomputedMaskTexture(shader, nextState);
	}
	if (!previous || previous.paletteIndex !== nextState.paletteIndex) {
		textureUpdates.u_palette = getPaletteTexture(nextState.paletteIndex);
	}
	if (!previous || previous.paletteIndex !== nextState.paletteIndex || previous.maskSize !== nextState.maskSize) {
		textureUpdates.u_knollPlan = getKnollTexture(nextState.paletteIndex, nextState.maskSize);
	}

	if (Object.keys(textureUpdates).length > 0) {
		shader.updateTextures(textureUpdates);
	}

	shaderStates.set(shader, nextState);
}

const DEFAULT_STATE = {
	strategyIndex: 0,
	paletteIndex: 0,
	cellSize: CELL_SIZE_INITIAL,
	maskSize: MASK_SIZE_INITIAL,
};

const DEFAULT_STRATEGY_MASK_SIZES = getMaskSizes(DEFAULT_STATE.strategyIndex);

export default {
	name: 'Dither',
	hash: 'dither',
	controls: [
		['Strategy', 'Palette'],
		['Pixel size', 'Mask size'],
	],
	controlValues: {
		x1: 0,
		x2: 0,
		y1: normalize(CELL_SIZE_MIN, CELL_SIZE_MAX, CELL_SIZE_INITIAL),
		y2: normalize(
			0,
			DEFAULT_STRATEGY_MASK_SIZES.length - 1,
			DEFAULT_STRATEGY_MASK_SIZES.indexOf(MASK_SIZE_INITIAL),
		),
	},
	controlModifiers: {
		x1: { precision: 0.005, loop: true },
		x2: { precision: 0.005, loop: true },
		y1: { precision: 0.005 },
		y2: { precision: 0.005 },
	},
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [helpers(), save(), autosize()],
		});
		shader.initializeUniform('u_cellSizePx', 'float', DEFAULT_STATE.cellSize);
		shader.initializeUniform('u_maskSize', 'int', DEFAULT_STATE.maskSize);
		shader.initializeTexture(
			'u_mask',
			getImmediateMaskTexture(DEFAULT_STATE.strategyIndex, DEFAULT_STATE.maskSize),
			MASK_TEXTURE_OPTIONS,
		);
		shader.initializeTexture('u_palette', getPaletteTexture(DEFAULT_STATE.paletteIndex), PALETTE_TEXTURE_OPTIONS);
		shader.initializeTexture(
			'u_knollPlan',
			getKnollTexture(DEFAULT_STATE.paletteIndex, DEFAULT_STATE.maskSize),
			KNOLL_TEXTURE_OPTIONS,
		);
		shaderStates.set(shader, { ...DEFAULT_STATE });
		requestPrecomputedMaskTexture(shader, DEFAULT_STATE);
		setShader(shader);
	},
	onUpdate(controls, shader) {
		syncShader(shader, getSceneStateFromControls(controls));
	},
};
