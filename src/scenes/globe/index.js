import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './globe.glsl';

export default {
	name: 'Globe',
	hash: 'globe',
	controls: [[], []],
	controlValues: {},
	initialize(setShader) {
		const shader = new ShaderPad(fragmentShaderSrc, { plugins: [save()] });
		setShader(shader);
	},
	onUpdate(_uniformValues, _shader) {},
};
