import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './cut-glass.glsl';

const MIN_N_STRIPS = 3;
const MAX_N_STRIPS = 100;
const N_STRIPS_INITIAL = 33;
const MIN_REFRACTION_INTENSITY = 0;
const MAX_REFRACTION_INTENSITY = 5;
const REFRACTION_INTENSITY_INITIAL = 2;

function getInitialControlValue(min, max, initial) {
	return (initial - min) / (max - min);
}

export default {
	name: 'Cut glass',
	hash: 'cut-glass',
	controls: [['Refraction intensity'], ['Number of strips']],
	controlValues: {
		x1: getInitialControlValue(MIN_REFRACTION_INTENSITY, MAX_REFRACTION_INTENSITY, REFRACTION_INTENSITY_INITIAL),
		y1: getInitialControlValue(MIN_N_STRIPS, MAX_N_STRIPS, N_STRIPS_INITIAL),
	},
	controlPrecision: {
		x1: 0.01,
	},
	initialize(setShader) {
		const shader = new ShaderPad(fragmentShaderSrc, { plugins: [helpers(), save()] });
		shader.initializeUniform('u_refractionIntensity', 'float', REFRACTION_INTENSITY_INITIAL);
		shader.initializeUniform('u_nStrips', 'float', N_STRIPS_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		const refractionIntensity =
			MIN_REFRACTION_INTENSITY + x1 * (MAX_REFRACTION_INTENSITY - MIN_REFRACTION_INTENSITY);
		const nStrips = Math.round(MIN_N_STRIPS + y1 * (MAX_N_STRIPS - MIN_N_STRIPS));
		shader.updateUniforms({
			u_refractionIntensity: refractionIntensity,
			u_nStrips: nStrips,
		});
	},
};
