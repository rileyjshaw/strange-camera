import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './cut-glass.glsl';
import { normalize, lerp } from '../util.js';

const MIN_N_STRIPS = 3;
const MAX_N_STRIPS = 100;
const N_STRIPS_INITIAL = 33;
const MIN_REFRACTION_INTENSITY = 0;
const MAX_REFRACTION_INTENSITY = 5;
const REFRACTION_INTENSITY_INITIAL = 2;

export default {
	name: 'Cut Glass',
	hash: 'cut-glass',
	controls: [['Refraction intensity'], ['Number of strips']],
	controlValues: {
		x1: normalize(MIN_REFRACTION_INTENSITY, MAX_REFRACTION_INTENSITY, REFRACTION_INTENSITY_INITIAL),
		y1: normalize(MIN_N_STRIPS, MAX_N_STRIPS, N_STRIPS_INITIAL),
	},
	controlPrecision: {
		x1: 0.01,
	},
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, { canvas, plugins: [helpers(), save(), autosize()] });
		shader.initializeUniform('u_refractionIntensity', 'float', REFRACTION_INTENSITY_INITIAL);
		shader.initializeUniform('u_nStrips', 'float', N_STRIPS_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		const refractionIntensity = lerp(MIN_REFRACTION_INTENSITY, MAX_REFRACTION_INTENSITY, x1);
		const nStrips = Math.round(lerp(MIN_N_STRIPS, MAX_N_STRIPS, y1));
		shader.updateUniforms({
			u_refractionIntensity: refractionIntensity,
			u_nStrips: nStrips,
		});
	},
};
