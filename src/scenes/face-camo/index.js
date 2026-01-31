import ShaderPad from 'shaderpad';
import face from 'shaderpad/plugins/face';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './face-camo.glsl';
import { lerp } from '../util.js';

const OFFSET_PIXELS_MIN = 1;
const OFFSET_PIXELS_MAX = 160;
const OFFSET_PIXELS_INITIAL = 20;

export default {
	name: 'Face Camo',
	hash: 'face-camo',
	controls: [[], ['Offset pixels']],
	controlValues: { y1: OFFSET_PIXELS_INITIAL / OFFSET_PIXELS_MAX },
	pluginReadyEvents: ['face:ready'],
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [
				helpers(),
				save(),
				autosize(),
				face({
					textureName: 'u_inputStream',
					options: { maxFaces: 3 },
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
