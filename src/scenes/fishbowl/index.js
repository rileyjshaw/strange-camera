import ShaderPad from 'shaderpad';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './fishbowl.glsl';

const SHADOW_INITIAL = 0.33;

export default {
	name: 'Fishbowl',
	hash: 'fishbowl',
	controls: [['Shadow'], []],
	controlValues: { x1: SHADOW_INITIAL },
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, { canvas, plugins: [save()] });
		shader.initializeUniform('u_shadow', 'float', SHADOW_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1 }, shader) {
		shader.updateUniforms({ u_shadow: x1 });
	},
};
