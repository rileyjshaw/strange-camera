import ShaderPad from 'shaderpad';
import pose from 'shaderpad/plugins/pose';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './body-camo.glsl';
import { lerp } from '../util.js';

const OFFSET_PIXELS_MIN = 1;
const OFFSET_PIXELS_MAX = 180;
const OFFSET_PIXELS_INITIAL = 40;

export default {
	name: 'Body Camo',
	hash: 'body-camo',
	controls: [[], ['Offset pixels']],
	controlValues: { y1: OFFSET_PIXELS_INITIAL / OFFSET_PIXELS_MAX },
	pluginReadyEvents: ['pose:ready'],
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [
				helpers(),
				save(),
				autosize(),
				pose({
					textureName: 'u_inputStream',
					options: { maxPoses: 2 },
				}),
			],
		});
		shader.initializeUniform('u_offsetPixels', 'float', OFFSET_PIXELS_INITIAL);
		setShader(shader);
	},
	onUpdate({ y1 }, shader) {
		const offsetPixels = lerp(OFFSET_PIXELS_MIN, OFFSET_PIXELS_MAX, y1);
		shader.updateUniforms({ u_offsetPixels: offsetPixels });
	},
};
