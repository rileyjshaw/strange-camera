import ShaderPad from 'shaderpad';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './fishbowl.glsl';

export default {
	name: 'Fishbowl',
	hash: 'fishbowl',
	controls: [[], []],
	controlValues: {},
	initialize(setShader) {
		const shader = new ShaderPad(fragmentShaderSrc, { plugins: [save()] });
		setShader(shader);
	},
	onUpdate(_uniformValues, _shader) {},
};
