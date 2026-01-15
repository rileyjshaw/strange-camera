import ShaderPad from 'shaderpad';
import face from 'shaderpad/plugins/face';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './big-face.glsl';
import { lerp } from '../util.js';

const SCALE_MIN = 1;
const SCALE_MAX = 6;
const SCALE_INITIAL = 3;
const RATIO_INITIAL = 0.5;

export default {
	name: 'Big Face',
	hash: 'big-face',
	controls: [['Ratio'], ['Scale']],
	controlValues: { x1: RATIO_INITIAL, y1: (SCALE_INITIAL - SCALE_MIN) / (SCALE_MAX - SCALE_MIN) },
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [
				helpers(),
				save(),
				face({
					textureName: 'u_inputStream',
					options: { maxFaces: 3 },
				}),
			],
		});
		shader.initializeUniform('u_scale', 'float', SCALE_INITIAL);
		shader.initializeUniform('u_ratio', 'float', RATIO_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		const scale = lerp(SCALE_MIN, SCALE_MAX, y1);
		shader.updateUniforms({ u_ratio: x1, u_scale: scale });
	},
};
