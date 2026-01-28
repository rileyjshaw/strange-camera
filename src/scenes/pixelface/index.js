import ShaderPad from 'shaderpad';
import face from 'shaderpad/plugins/face';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './pixelface.glsl';
import { lerp } from '../util.js';

const FACE_SCALE_MIN = 0.75;
const FACE_SCALE_MAX = 1.5;
const FACE_SCALE_INITIAL = 1.25;
const PIXEL_SIZE_INITIAL = 0.5;
const MODE_INITIAL = 1.0;

export default {
	name: 'Pixelface',
	hash: 'pixelface',
	controls: [['Face size', 'Pixel size'], ['Mode']],
	controlValues: {
		x1: (FACE_SCALE_INITIAL - FACE_SCALE_MIN) / (FACE_SCALE_MAX - FACE_SCALE_MIN),
		x2: PIXEL_SIZE_INITIAL,
		y1: MODE_INITIAL,
	},
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
		shader.initializeUniform('u_faceScale', 'float', FACE_SCALE_INITIAL);
		shader.initializeUniform('u_pixelSize', 'float', PIXEL_SIZE_INITIAL);
		shader.initializeUniform('u_mode', 'float', MODE_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, x2, y1 }, shader) {
		shader.updateUniforms({
			u_faceScale: lerp(FACE_SCALE_MIN, FACE_SCALE_MAX, x1),
			u_pixelSize: x2,
			u_mode: y1,
		});
	},
};
