import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';

import exciteSrc from './mesh-excite.glsl';
import diffuseHSrc from './mesh-diffuse-h.glsl';
import diffuseVSrc from './mesh-diffuse-v.glsl';
import outputSrc from './mesh-output.glsl';
import { lerp } from '../util.js';

const DIFFUSION_ITERATIONS_MIN = 1;
const DIFFUSION_ITERATIONS_MAX = 4;
const SIGMA_MIN = 0.35;
const SIGMA_MAX = 18.0;
const SIGMA_INITIAL = 3.5;
const INTENSITY_COUPLING_INITIAL = 0.58;
const ANISOTROPY_INITIAL = 0.5;
const PERSISTENCE_INITIAL = 0.35;
const SPECTRAL_SPREAD_INITIAL = 0.22;
const HALATION_STRENGTH_MIN = 0.05;
const HALATION_STRENGTH_MAX = 1.45;

const EXCITE_UNIFORMS = new Set(['u_intensityCoupling', 'u_sigma']);
const DIFFUSE_H_UNIFORMS = new Set(['u_sigma', 'u_anisotropy', 'u_spectralSpread']);
const DIFFUSE_V_UNIFORMS = new Set(['u_sigma', 'u_anisotropy', 'u_spectralSpread', 'u_persistence']);
const OUTPUT_UNIFORMS = new Set(['u_halationStrength', 'u_intensityCoupling', 'u_spectralSpread']);

let exciteShader, diffuseHShader, diffuseVShader, outputShader;
let currentInput = null;
let diffusionIterations = 2;

const chainOpts = (canvas, opts = {}) => ({
	canvas,
	plugins: [helpers()],
	internalFormat: 'RGBA16F',
	type: 'HALF_FLOAT',
	...opts,
});

function scaleRadius(t) {
	return SIGMA_MIN * Math.pow(SIGMA_MAX / SIGMA_MIN, t);
}

function scalePersistence(t) {
	const shaped = 1 - Math.pow(1 - t, 2);
	return lerp(0.18, 0.985, shaped);
}

function getDiffusionIterations(t) {
	return Math.round(lerp(DIFFUSION_ITERATIONS_MIN, DIFFUSION_ITERATIONS_MAX, t));
}

function updateUniformSubset(shader, updates, allowedUniforms) {
	const nextUpdates = {};
	for (const [name, value] of Object.entries(updates)) {
		if (allowedUniforms.has(name)) nextUpdates[name] = value;
	}
	if (Object.keys(nextUpdates).length > 0) shader.updateUniforms(nextUpdates);
}

function getUniformValues({ x1, x2, x3, y1, y2 }) {
	return {
		u_sigma: scaleRadius(x1),
		u_intensityCoupling: x2,
		u_anisotropy: x3,
		u_persistence: scalePersistence(y1),
		u_spectralSpread: y2,
		u_halationStrength: lerp(HALATION_STRENGTH_MIN, HALATION_STRENGTH_MAX, x2),
	};
}

const INITIAL_CONTROLS = {
	x1: Math.log(SIGMA_INITIAL / SIGMA_MIN) / Math.log(SIGMA_MAX / SIGMA_MIN),
	x2: INTENSITY_COUPLING_INITIAL,
	x3: ANISOTROPY_INITIAL,
	y1: PERSISTENCE_INITIAL,
	y2: SPECTRAL_SPREAD_INITIAL,
};

export default {
	name: 'Mesh Sensor',
	hash: 'mesh-sensor',
	controls: [
		['Coupling radius', 'Highlight coupling', 'Direction bias'],
		['Field persistence', 'Spectral spread'],
	],
	controlValues: INITIAL_CONTROLS,
	controlModifiers: {
		y1: { precision: 0.0025 },
		y2: { precision: 0.0025 },
	},
	maxTextureSize: 720,
	initialize(setShader, canvas) {
		diffusionIterations = getDiffusionIterations(INITIAL_CONTROLS.x1);
		const initialUniforms = getUniformValues(INITIAL_CONTROLS);

		exciteShader = new ShaderPad(exciteSrc, chainOpts(canvas));
		diffuseHShader = new ShaderPad(diffuseHSrc, chainOpts(canvas));
		diffuseVShader = new ShaderPad(diffuseVSrc, chainOpts(canvas, { history: 1 }));
		outputShader = new ShaderPad(outputSrc, {
			canvas,
			plugins: [helpers()],
		});

		exciteShader.initializeUniform('u_intensityCoupling', 'float', initialUniforms.u_intensityCoupling);
		exciteShader.initializeUniform('u_sigma', 'float', initialUniforms.u_sigma);
		diffuseHShader.initializeUniform('u_sigma', 'float', initialUniforms.u_sigma);
		diffuseHShader.initializeUniform('u_anisotropy', 'float', initialUniforms.u_anisotropy);
		diffuseHShader.initializeUniform('u_spectralSpread', 'float', initialUniforms.u_spectralSpread);
		diffuseVShader.initializeUniform('u_sigma', 'float', initialUniforms.u_sigma);
		diffuseVShader.initializeUniform('u_anisotropy', 'float', initialUniforms.u_anisotropy);
		diffuseVShader.initializeUniform('u_spectralSpread', 'float', initialUniforms.u_spectralSpread);
		diffuseVShader.initializeUniform('u_persistence', 'float', initialUniforms.u_persistence);
		outputShader.initializeUniform('u_halationStrength', 'float', initialUniforms.u_halationStrength);
		outputShader.initializeUniform('u_intensityCoupling', 'float', initialUniforms.u_intensityCoupling);
		outputShader.initializeUniform('u_spectralSpread', 'float', initialUniforms.u_spectralSpread);

		diffuseHShader.initializeTexture('u_input', exciteShader);
		diffuseVShader.initializeTexture('u_input', diffuseHShader);
		outputShader.initializeTexture('u_fieldState', diffuseVShader);

		function resetField() {
			diffuseVShader?.reset();
		}

		const composite = {
			initializeTexture(name, source) {
				if (name === 'u_inputStream') {
					currentInput = source;
					exciteShader.initializeTexture('u_inputStream', source);
					outputShader.initializeTexture('u_inputStream', source);
					resetField();
				}
			},
			updateTextures(updates) {
				if (updates?.u_inputStream) {
					if (currentInput !== updates.u_inputStream) resetField();
					currentInput = updates.u_inputStream;
				}
			},
			updateUniforms(updates) {
				updateUniformSubset(exciteShader, updates, EXCITE_UNIFORMS);
				updateUniformSubset(diffuseHShader, updates, DIFFUSE_H_UNIFORMS);
				updateUniformSubset(diffuseVShader, updates, DIFFUSE_V_UNIFORMS);
				updateUniformSubset(outputShader, updates, OUTPUT_UNIFORMS);
			},
			play(cb) {
				outputShader.play(() => {
					cb();
					if (!currentInput) return;
					exciteShader.updateTextures({ u_inputStream: currentInput });
					exciteShader.step();
					for (let i = 0; i < diffusionIterations; i++) {
						diffuseHShader.updateTextures({
							u_input: i === 0 ? exciteShader : diffuseVShader,
						});
						diffuseHShader.step();
						diffuseVShader.updateTextures({ u_input: diffuseHShader });
						diffuseVShader.step();
					}
					outputShader.updateTextures({
						u_inputStream: currentInput,
						u_fieldState: diffuseVShader,
					});
				});
			},
			pause() {
				outputShader.pause(...arguments);
			},
			draw() {
				outputShader.draw(...arguments);
			},
			resize() {
				resetField();
			},
			on() {
				outputShader.on(...arguments);
			},
			off() {
				outputShader.off(...arguments);
			},
			get canvas() {
				return outputShader.canvas;
			},
			destroy() {
				exciteShader.destroy();
				diffuseHShader.destroy();
				diffuseVShader.destroy();
				outputShader.destroy();
				exciteShader = diffuseHShader = diffuseVShader = outputShader = null;
				currentInput = null;
			},
		};

		setShader(composite);
	},
	onUpdate({ x1, x2, x3, y1, y2 }, shader) {
		diffusionIterations = getDiffusionIterations(x1);
		shader.updateUniforms(getUniformValues({ x1, x2, x3, y1, y2 }));
	},
};
