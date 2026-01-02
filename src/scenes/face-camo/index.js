import ShaderPad from 'shaderpad';
import face from 'shaderpad/plugins/face';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './face-camo.glsl';

const OFFSET_PIXELS_MIN = 1;
const OFFSET_PIXELS_MAX = 160;
const OFFSET_PIXELS_INITIAL = 20;

export default {
	name: 'Face Camo',
	hash: 'face-camo',
	controls: [[], ['Offset pixels']],
	controlValues: { y1: OFFSET_PIXELS_INITIAL / OFFSET_PIXELS_MAX },
	initialize(setShader) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			plugins: [
				helpers(),
				save(),
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
		const offsetPixels = OFFSET_PIXELS_MIN + y1 * (OFFSET_PIXELS_MAX - OFFSET_PIXELS_MIN);
		shader.updateUniforms({ u_offsetPixels: offsetPixels });
	},
};
