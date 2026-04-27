import ShaderPad from 'shaderpad';
import segmenter from 'shaderpad/plugins/segmenter';
import helpers from 'shaderpad/plugins/helpers';

import fragmentShaderSrc from './fill.glsl';
import {
	MEDIAPIPE_WASM_BASE_URL,
	SELFIE_MULTICLASS_SEGMENTER_MODEL_PATH,
} from '../mediapipe.js';

const OPACITY_INITIAL = 0.8;
const HUE_INITIAL = 0.33; // green
const BRIGHTNESS_INITIAL = 0.5;

export default {
	name: 'Fill',
	hash: 'fill',
	controls: [['Opacity', 'Hue'], ['Brightness']],
	controlValues: {
		x1: OPACITY_INITIAL,
		x2: HUE_INITIAL,
		y1: BRIGHTNESS_INITIAL,
	},
	controlModifiers: {
		x1: {
			precision: 0.001,
		},
		x2: {
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
						modelPath: SELFIE_MULTICLASS_SEGMENTER_MODEL_PATH,
						outputConfidenceMasks: true,
					},
				}),
			],
		});
		shader.initializeUniform('u_opacity', 'float', OPACITY_INITIAL);
		shader.initializeUniform('u_hue', 'float', HUE_INITIAL);
		shader.initializeUniform('u_brightness', 'float', BRIGHTNESS_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, x2, y1 }, shader) {
		shader.updateUniforms({
			u_opacity: x1,
			u_hue: x2,
			u_brightness: y1,
		});
	},
};
