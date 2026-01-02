import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';

import fragmentShaderSrc from './channels.glsl';

const N_ECHOES_MIN = 1;
const N_ECHOES_MAX = 4;
const N_ECHOES_INITIAL = N_ECHOES_MIN;
const FRAME_DELAY_PER_ECHO_MIN = 8;
const FRAME_DELAY_PER_ECHO_MAX = 80;
const FRAME_DELAY_PER_ECHO_INITIAL = Math.floor((FRAME_DELAY_PER_ECHO_MIN + FRAME_DELAY_PER_ECHO_MAX) / 2);
const maxFrameDelay = FRAME_DELAY_PER_ECHO_MAX * (N_ECHOES_MAX - 1) + 1;

function getDimmingFactor(nEchoes) {
	return 2 / (nEchoes + 1) / nEchoes;
}

const uniformValues = {};
export default {
	name: 'Channels',
	hash: 'channels',
	controls: [['Number of echoes'], ['Delay per echo']],
	controlValues: { x1: 0 },
	history: maxFrameDelay,
	initialize(setShader) {
		const shader = new ShaderPad(fragmentShaderSrc, { plugins: [helpers(), save()] });
		shader.initializeUniform('u_nEchoes', 'int', N_ECHOES_INITIAL);
		shader.initializeUniform('u_frameDelayPerEcho', 'int', FRAME_DELAY_PER_ECHO_INITIAL);
		shader.initializeUniform('u_dimmingFactor', 'float', getDimmingFactor(N_ECHOES_INITIAL));
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		const nEchoes = Math.floor(N_ECHOES_MIN + x1 * (N_ECHOES_MAX - N_ECHOES_MIN));
		const frameDelayPerEcho = Math.floor(
			FRAME_DELAY_PER_ECHO_MIN + y1 * (FRAME_DELAY_PER_ECHO_MAX - FRAME_DELAY_PER_ECHO_MIN)
		);
		if (nEchoes === uniformValues.u_nEchoes && frameDelayPerEcho === uniformValues.u_frameDelayPerEcho) {
			return;
		}

		uniformValues.u_nEchoes = nEchoes;
		uniformValues.u_frameDelayPerEcho = frameDelayPerEcho;
		uniformValues.u_dimmingFactor = getDimmingFactor(nEchoes);
		shader.updateUniforms(uniformValues);
	},
};
