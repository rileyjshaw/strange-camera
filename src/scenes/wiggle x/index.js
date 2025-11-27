// Inspo: https://timewiggler.com/
import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './wiggle x.glsl';

export default {
	name: 'Wiggle X',
	controls: [['Number of columns'], ['Delay per column']],
	controlValues: { x1: 1, y1: 0 },
	history: 196,
	initialize(setShader) {
		const shader = new ShaderPad(fragmentShaderSrc, { plugins: [helpers(), save()] });
		setShader(shader);
	},
};
