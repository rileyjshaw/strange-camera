import ShaderPad from 'shaderpad';
import segmenter from 'shaderpad/plugins/segmenter';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './salon.glsl';

const HUE_INITIAL = 0.5;
const BRIGHTNESS_INITIAL = 0.5;

export default {
	name: 'Salon',
	hash: 'salon',
	controls: [['Hue'], ['Brightness']],
	controlValues: {
		x1: HUE_INITIAL,
		y1: BRIGHTNESS_INITIAL,
	},
	controlPrecision: {
		x1: 0.001,
		y1: 0.0015,
	},
	controlModifiers: {
		x1: {
			loop: true,
		},
	},
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [
				helpers(),
				save(),
				autosize(),
				segmenter({
					textureName: 'u_inputStream',
				}),
			],
		});
		shader.initializeUniform('u_hue', 'float', HUE_INITIAL);
		shader.initializeUniform('u_brightness', 'float', BRIGHTNESS_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		shader.updateUniforms({
			u_hue: x1,
			u_brightness: y1,
		});
	},
};
