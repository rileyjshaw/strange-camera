import ShaderPad from 'shaderpad';
import segmenter from 'shaderpad/plugins/segmenter';
import helpers from 'shaderpad/plugins/helpers';

import fragmentShaderSrc from './body-double.glsl';
import { normalize, lerp } from '../util.js';
import { MEDIAPIPE_WASM_BASE_URL, SELFIE_SEGMENTER_MODEL_PATH } from '../mediapipe.js';

const HISTORY_SIZE = 120;
const N_ECHOES_MIN = 1;
const N_ECHOES_MAX = Math.floor(HISTORY_SIZE / 8);
const N_ECHOES_INITIAL = 5;

export default {
	name: 'Body Double',
	hash: 'body-double',
	controls: [['Echo count'], ['Delay per echo']],
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
				segmenter({
					textureName: 'u_inputStream',
					wasmBaseUrl: MEDIAPIPE_WASM_BASE_URL,
					options: { modelPath: SELFIE_SEGMENTER_MODEL_PATH, history: HISTORY_SIZE },
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
