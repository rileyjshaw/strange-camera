import ShaderPad from 'shaderpad';
import segmenter from 'shaderpad/plugins/segmenter';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './fill.glsl';

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
				save(),
				autosize(),
				segmenter({
					textureName: 'u_inputStream',
					options: {
						modelPath:
							'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
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
