// Inspo: https://timewiggler.com/
import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './wiggle y.glsl';

export default {
	name: 'Wiggle Y',
	controls: [['Number of strips'], ['Delay per strip']],
	webcamHistory: 196,
	initialize(setShader) {
		const shader = new ShaderPad(fragmentShaderSrc, { plugins: [helpers(), save()] });
		setShader(shader);
	},
};
