import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './cutup.glsl';

const N_SHUFFLES_MIN = 1;
const N_SHUFFLES_MAX = 10;
const N_SHUFFLES_INITIAL = N_SHUFFLES_MIN;
const N_STRIPS_MIN = 2;
const N_STRIPS_MAX = 1920;
const N_STRIPS_INITIAL = 32;

function isPowerOfTwo(n) {
	return (n & (n - 1)) === 0;
}

function getPowerOfTwoExponent(n) {
	return 31 - Math.clz32(n);
}

const getStepSize = (() => {
	const stepSizes = new Map();
	const cycleLengths = new Map();
	return function getStepSize(nShuffles, nStrips) {
		nShuffles = Math.floor(nShuffles);
		if (cycleLengths.has(nStrips)) {
			nShuffles = nShuffles % cycleLengths.get(nStrips);
		}
		if (nShuffles === 0 || nStrips < 2) return 1; // Normal image.
		if (nShuffles === 1) return nStrips - 1;
		if (nShuffles === 2) return Math.floor(nStrips / 2);
		const key = `${nShuffles},${nStrips}`;
		if (stepSizes.has(key)) return stepSizes.get(key);

		let fromArray = new Uint16Array(nStrips);
		let destArray = new Uint16Array(nStrips);
		for (let i = 0; i < nStrips; ++i) {
			destArray[i] = i;
		}
		for (let shuffleCount = 1; shuffleCount <= nShuffles; ++shuffleCount) {
			[fromArray, destArray] = [destArray, fromArray]; // Swap arrays.
			for (let j = 0, _len = nStrips / 2, _cutoff = Math.floor(_len); j < _len; ++j) {
				const destIdx = j * 2;
				destArray[destIdx] = fromArray[j];
				if (j < _cutoff) destArray[destIdx + 1] = fromArray.at(-1 - j);
			}

			// Memoize intermediate steps.
			const step = destArray[1];
			if (shuffleCount > 2) {
				const memoKey = `${shuffleCount},${nStrips}`;
				if (!stepSizes.has(memoKey)) stepSizes.set(memoKey, step);
			}

			// If destArray[1] is a power of two, we can short-circuit the rest of the shuffles, since the next steps
			// are just descending powers of two. It loops once it hits 1, so we can just fill the stepSizes and
			// cycleLengths memos for this nShuffles then call getStepSize again to hit the memoized early exit.
			if (isPowerOfTwo(step)) {
				let exponent = getPowerOfTwoExponent(step);
				cycleLengths.set(nStrips, shuffleCount + exponent);
				for (let i = 1; i < exponent; ++i) {
					stepSizes.set(`${shuffleCount + i},${nStrips}`, 1 << (exponent - i));
				}
				return getStepSize(nShuffles, nStrips); // It’s memoized.
			}
		}
		return destArray[1];
	};
})();

function getInitialControlValue(min, max, initial) {
	return (initial - min) / (max - min);
}

const uniformValues = {};
export default {
	name: 'Cutup',
	controls: [['Number of shuffles'], ['Number of strips']],
	controlValues: {
		x1: getInitialControlValue(N_SHUFFLES_MIN, N_SHUFFLES_MAX, N_SHUFFLES_INITIAL),
		y1: getInitialControlValue(N_STRIPS_MIN, N_STRIPS_MAX, N_STRIPS_INITIAL),
	},
	controlPrecision: {
		x1: 0.002,
	},
	initialize(setShader) {
		const shader = new ShaderPad(fragmentShaderSrc, { plugins: [helpers(), save()] });
		uniformValues.u_nShuffles = N_SHUFFLES_INITIAL;
		uniformValues.u_nStrips = N_STRIPS_INITIAL;
		uniformValues.u_stepSize = getStepSize(N_SHUFFLES_INITIAL, N_STRIPS_INITIAL);
		shader.initializeUniform('u_nShuffles', 'int', uniformValues.u_nShuffles);
		shader.initializeUniform('u_nStrips', 'float', uniformValues.u_nStrips);
		shader.initializeUniform('u_stepSize', 'float', uniformValues.u_stepSize);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		const nShuffles = Math.round(N_SHUFFLES_MIN + x1 * (N_SHUFFLES_MAX - N_SHUFFLES_MIN));
		const nStrips = Math.round(N_STRIPS_MIN + y1 * (N_STRIPS_MAX - N_STRIPS_MIN));
		if (nShuffles === uniformValues.u_nShuffles && nStrips === uniformValues.u_nStrips) {
			return;
		}

		uniformValues.u_nShuffles = nShuffles;
		uniformValues.u_nStrips = nStrips;
		uniformValues.u_stepSize = getStepSize(nShuffles, nStrips);
		shader.updateUniforms(uniformValues);
	},
};
