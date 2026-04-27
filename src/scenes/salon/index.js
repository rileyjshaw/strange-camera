import ShaderPad from 'shaderpad';
import segmenter from 'shaderpad/plugins/segmenter';
import helpers from 'shaderpad/plugins/helpers';

import fragmentShaderSrc from './salon.glsl';
import { HAIR_SEGMENTER_MODEL_PATH, MEDIAPIPE_WASM_BASE_URL } from '../mediapipe.js';

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
	controlModifiers: {
		x1: {
			precision: 0.001,
			loop: true,
		},
		y1: {
			precision: 0.0015,
		},
	},
	pluginReadyEvents: ['segmenter:ready'],
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [
				helpers(),
				segmenter({
					textureName: 'u_inputStream',
					wasmBaseUrl: MEDIAPIPE_WASM_BASE_URL,
					options: {
						modelPath: HAIR_SEGMENTER_MODEL_PATH,
						outputConfidenceMasks: true,
					},
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
