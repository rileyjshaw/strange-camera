import ShaderPad from 'shaderpad';
import segmenter from 'shaderpad/plugins/segmenter';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './body-double.glsl';
import { normalize, lerp } from '../util.js';

const HISTORY_SIZE = 120;
const N_ECHOES_MIN = 1;
const N_ECHOES_MAX = Math.floor(HISTORY_SIZE / 8);
const N_ECHOES_INITIAL = 5;

export default {
	name: 'Body Double',
	hash: 'body-double',
	controls: [['Number of echoes'], ['Delay per echo']],
	controlValues: {
		x1: normalize(N_ECHOES_MIN, N_ECHOES_MAX, N_ECHOES_INITIAL),
		y1: 0.5,
	},
	history: HISTORY_SIZE,
	maxTextureSize: 720,
	pluginReadyEvents: ['segmenter:ready'],
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [
				helpers(),
				save(),
				autosize(),
				segmenter({
					textureName: 'u_inputStream',
					options: { history: HISTORY_SIZE },
				}),
			],
		});
		shader.initializeUniform('u_nEchoes', 'int', N_ECHOES_INITIAL);
		shader.initializeUniform('y1', 'float', 0.5);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		const nEchoes = Math.round(lerp(N_ECHOES_MIN, N_ECHOES_MAX, x1));
		shader.updateUniforms({ u_nEchoes: nEchoes, y1 });
	},
};
