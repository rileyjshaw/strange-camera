import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './light-trails.glsl';
import { normalize } from '../util.js';

const COLOR_BLEED_INITIAL = 0;
const FADE_INITIAL = normalize(-1, 1, -0.25);

export default {
	name: 'Light Trails',
	hash: 'light-trails',
	controls: [['Color bleed'], ['Fade duration']],
	controlValues: {
		x1: COLOR_BLEED_INITIAL,
		y1: FADE_INITIAL,
	},
	initialize(setShader, canvas, gl) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [helpers(), save(), autosize()],
			history: 1,
			internalFormat: 'RGBA16F',
			type: 'HALF_FLOAT',
		});
		shader.initializeUniform('u_colorBleedControl', 'float', COLOR_BLEED_INITIAL);
		shader.initializeUniform('u_fadeControl', 'float', FADE_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		shader.updateUniforms({ u_colorBleedControl: x1, u_fadeControl: y1 });
	},
};
