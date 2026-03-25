import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'src', 'scenes', 'dither', 'masks');
const manifestModulePath = path.join(projectRoot, 'src', 'scenes', 'dither', 'generated-mask-assets.js');

const MASK_SPECS = [
	{ key: 'blue-noise', sizes: [8, 16, 32, 64, 128, 256, 512], generator: generateBlueNoiseRanks },
	{
		key: 'tiled-noise',
		sizes: [8, 16, 32, 64, 128, 256],
		generator: size => generateRepeatedFieldRanks(size, 8, (x, y, period) => hashCoord(x, y, period)),
	},
	{ key: 'r-sequence', sizes: [4, 8, 16, 24, 32, 48], generator: generateRSequenceRanks },
];

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
		count
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
		period
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

function generateVoidAndClusterRanks(size) {
	const total = size * size;
	const ranks = new Uint32Array(total);
	const chosen = new Uint8Array(total);
	const minDistance = new Float32Array(total);
	minDistance.fill(Infinity);

	let nextIndex = 0;
	let bestSeed = -1;
	for (let index = 0; index < total; index++) {
		const x = index % size;
		const y = Math.floor(index / size);
		const score = hashCoord(x, y, size);
		if (score > bestSeed) {
			bestSeed = score;
			nextIndex = index;
		}
	}

	for (let rank = 0; rank < total; rank++) {
		chosen[nextIndex] = 1;
		ranks[nextIndex] = rank;
		const chosenX = nextIndex % size;
		const chosenY = Math.floor(nextIndex / size);

		let bestIndex = -1;
		let bestScore = -1;
		for (let index = 0; index < total; index++) {
			if (chosen[index]) continue;
			const x = index % size;
			const y = Math.floor(index / size);
			let dx = Math.abs(x - chosenX);
			let dy = Math.abs(y - chosenY);
			dx = Math.min(dx, size - dx);
			dy = Math.min(dy, size - dy);
			const distanceSq = dx * dx + dy * dy;
			if (distanceSq < minDistance[index]) {
				minDistance[index] = distanceSq;
			}
			const score = minDistance[index] + hashCoord(x, y, size) * 1e-4;
			if (score > bestScore) {
				bestScore = score;
				bestIndex = index;
			}
		}

		if (bestIndex >= 0) nextIndex = bestIndex;
	}

	return ranks;
}

function expandRankTile(size, baseSize, baseRanks, macroRanks, macroCount) {
	const ranks = new Uint32Array(size * size);
	const macroCellCount = macroCount * macroCount;

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const macroX = Math.floor(x / baseSize);
			const macroY = Math.floor(y / baseSize);
			const localX = x % baseSize;
			const localY = y % baseSize;
			const localRank = baseRanks[localY * baseSize + localX];
			const macroRank = macroRanks[macroY * macroCount + macroX];
			ranks[y * size + x] = localRank * macroCellCount + macroRank;
		}
	}

	return ranks;
}

function generateBlueNoiseRanks(size) {
	if (size <= 128) {
		return generateVoidAndClusterRanks(size);
	}

	const baseSize = 128;
	if (size % baseSize !== 0) {
		throw new Error(`Blue noise size ${size} is not divisible by ${baseSize}.`);
	}

	const macroCount = size / baseSize;
	const baseRanks = generateVoidAndClusterRanks(baseSize);
	const macroRanks = generateVoidAndClusterRanks(macroCount);
	return expandRankTile(size, baseSize, baseRanks, macroRanks, macroCount);
}

function generateWhiteNoiseRanks(size) {
	return ranksFromSortedCoords(
		generateRankedField(size, (x, y) => hashCoord(x, y, size * 0.61803398875)),
		size
	);
}

function generateRSequenceRanks(size) {
	const total = size * size;
	const plastic = 1.3247179572447458;
	const alpha = 1 / plastic;
	const beta = 1 / (plastic * plastic);
	const ranks = new Uint32Array(total);
	const occupied = new Uint8Array(total);

	for (let rank = 0; rank < total; rank++) {
		const targetX = Math.floor(fract(0.5 + (rank + 0.5) * alpha) * size);
		const targetY = Math.floor(fract(0.5 + (rank + 0.5) * beta) * size);

		let bestIndex = -1;
		let bestDistance = Infinity;
		let bestTiebreak = Infinity;

		for (let index = 0; index < total; index++) {
			if (occupied[index]) continue;
			const x = index % size;
			const y = Math.floor(index / size);
			let dx = Math.abs(x - targetX);
			let dy = Math.abs(y - targetY);
			dx = Math.min(dx, size - dx);
			dy = Math.min(dy, size - dy);
			const distanceSq = dx * dx + dy * dy;
			const tiebreak = hashCoord(x, y, rank);

			if (
				distanceSq < bestDistance ||
				(distanceSq === bestDistance && tiebreak < bestTiebreak)
			) {
				bestDistance = distanceSq;
				bestTiebreak = tiebreak;
				bestIndex = index;
			}
		}

		occupied[bestIndex] = 1;
		ranks[bestIndex] = rank;
	}

	return ranks;
}

function packRanksToRgbBytes(ranks) {
	const packed = Buffer.alloc(ranks.length * 3);
	for (let index = 0; index < ranks.length; index++) {
		const rank = ranks[index];
		const offset = index * 3;
		packed[offset] = rank & 0xff;
		packed[offset + 1] = (rank >> 8) & 0xff;
		packed[offset + 2] = (rank >> 16) & 0xff;
	}
	return packed;
}

function writePpm(filepath, size, packedBytes) {
	const header = Buffer.from(`P6\n${size} ${size}\n255\n`, 'ascii');
	fs.writeFileSync(filepath, Buffer.concat([header, packedBytes]));
}

function runCommand(command, args) {
	const result = spawnSync(command, args, { stdio: 'inherit' });
	if (result.status !== 0) {
		throw new Error(`Command failed: ${command} ${args.join(' ')}`);
	}
}

function ensureDir(dirpath) {
	fs.mkdirSync(dirpath, { recursive: true });
}

function toImportName(key, size) {
	return `mask${key.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase())}${size}`;
}

function buildManifestModule(entries) {
	const importLines = [];
	const bodyLines = ['export default {'];

	for (const strategy of entries) {
		bodyLines.push(`\t'${strategy.key}': {`);
		bodyLines.push(`\t\tsizes: [${strategy.sizes.join(', ')}],`);
		bodyLines.push('\t\tentries: {');
		for (const asset of strategy.assets) {
			importLines.push(`import ${asset.importName} from './masks/${asset.filename}?url&no-inline';`);
			bodyLines.push(`\t\t\t'${asset.size}': ${asset.importName},`);
		}
		bodyLines.push('\t\t},');
		bodyLines.push('\t},');
	}

	bodyLines.push('};');
	return `${importLines.join('\n')}\n\n${bodyLines.join('\n')}\n`;
}

function generateMaskAssets() {
	fs.rmSync(outputDir, { recursive: true, force: true });
	ensureDir(outputDir);
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dither-mask-assets-'));
	const manifestEntries = [];

	try {
		for (const spec of MASK_SPECS) {
			const assets = [];
			for (const size of spec.sizes) {
				const basename = `${spec.key}-${size}`;
				const ranks = spec.generator(size);
				const packedBytes = packRanksToRgbBytes(ranks);
				const ppmPath = path.join(tempDir, `${basename}.ppm`);
				const pngPath = path.join(outputDir, `${basename}.png`);
				const webpPath = path.join(outputDir, `${basename}.webp`);

				writePpm(ppmPath, size, packedBytes);
				runCommand('magick', [
					ppmPath,
					'-define',
					'png:compression-filter=5',
					'-define',
					'png:compression-level=9',
					'-define',
					'png:compression-strategy=1',
					pngPath,
				]);
				runCommand('cwebp', ['-quiet', '-lossless', ppmPath, '-o', webpPath]);

				const pngBytes = fs.statSync(pngPath).size;
				const webpBytes = fs.statSync(webpPath).size;
				const chosenPath = webpBytes <= pngBytes ? webpPath : pngPath;
				const otherPath = chosenPath === webpPath ? pngPath : webpPath;
				const chosenExt = path.extname(chosenPath);

				if (fs.existsSync(otherPath)) {
					fs.unlinkSync(otherPath);
				}

				assets.push({
					size,
					filename: `${basename}${chosenExt}`,
					importName: toImportName(spec.key, size),
				});
			}

			manifestEntries.push({
				key: spec.key,
				sizes: spec.sizes,
				assets,
			});
		}

		fs.writeFileSync(manifestModulePath, buildManifestModule(manifestEntries));
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

generateMaskAssets();
