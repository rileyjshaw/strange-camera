// Inspo: https://timewiggler.com/
import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './wiggle x.glsl';

const X1_INITIAL = 1;
const Y1_INITIAL = 0;

export default {
	name: 'Wiggle X',
	hash: 'wiggle-x',
	controls: [['Number of columns'], ['Delay per column']],
	controlValues: { x1: X1_INITIAL, y1: Y1_INITIAL },
	history: 196,
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, { canvas, plugins: [helpers(), save(), autosize()] });
		shader.initializeUniform('x1', 'float', X1_INITIAL);
		shader.initializeUniform('y1', 'float', Y1_INITIAL);
		setShader(shader);
	},
	onUpdate(uniformValues, shader) {
		shader.updateUniforms(uniformValues);
	},
};
