import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './light-trails.glsl';
import { normalize } from '../util.js';

const FADE_INITIAL = normalize(-1, 1, -0.25);
const COLOR_BLEED_INITIAL = 0;

export default {
	name: 'Light Trails',
	hash: 'light-trails',
	controls: [['Fade duration'], ['Color bleed']],
	controlValues: {
		x1: FADE_INITIAL,
		y1: COLOR_BLEED_INITIAL,
	},
	initialize(setShader, canvas, gl) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [helpers(), save()],
			history: 1,
			internalFormat: gl.RGBA16F,
			type: gl.HALF_FLOAT,
		});
		shader.initializeUniform('u_fadeControl', 'float', FADE_INITIAL);
		shader.initializeUniform('u_colorBleedControl', 'float', COLOR_BLEED_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		shader.updateUniforms({ u_fadeControl: x1, u_colorBleedControl: y1 });
	},
};
