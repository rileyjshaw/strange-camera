import ShaderPad from 'shaderpad';
import face from 'shaderpad/plugins/face';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './sunday.glsl';

const COLOR_VALUE_INITIAL = 1;
const GLOW_AMOUNT_INITIAL = 0.2;

export default {
	name: 'Sunday',
	hash: 'sunday',
	controls: [['Glow'], ['Color']],
	controlValues: { x1: GLOW_AMOUNT_INITIAL, y1: COLOR_VALUE_INITIAL },
	controlPrecision: {
		y1: 0.002,
	},
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [
				helpers(),
				save(),
				face({
					textureName: 'u_inputStream',
					options: { maxFaces: 4 },
				}),
			],
		});
		shader.initializeUniform('u_color', 'float', COLOR_VALUE_INITIAL);
		shader.initializeUniform('u_glow', 'float', GLOW_AMOUNT_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		shader.updateUniforms({
			u_glow: x1,
			u_color: y1,
		});
	},
};
