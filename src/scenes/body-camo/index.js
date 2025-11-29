import ShaderPad from 'shaderpad';
import pose from 'shaderpad/plugins/pose';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './body-camo.glsl';

const OFFSET_PIXELS_MIN = 0;
const OFFSET_PIXELS_MAX = 180;
const OFFSET_PIXELS_INITIAL = 20;

export default {
	name: 'Body Camo',
	controls: [[], ['Offset pixels']],
	controlValues: { y1: OFFSET_PIXELS_INITIAL / OFFSET_PIXELS_MAX },
	initialize(setShader) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			plugins: [
				helpers(),
				save(),
				pose({
					textureName: 'u_inputStream',
					options: { maxPoses: 2 },
				}),
			],
			history: 1,
		});
		shader.initializeUniform('u_offsetPixels', 'float', OFFSET_PIXELS_INITIAL);
		setShader(shader);
	},
	onUpdate({ y1 }, shader) {
		const offsetPixels = OFFSET_PIXELS_MIN + y1 * (OFFSET_PIXELS_MAX - OFFSET_PIXELS_MIN);
		shader.updateUniforms({ u_offsetPixels: offsetPixels });
	},
};
