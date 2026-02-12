import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './slow.glsl';
import { lerp } from '../util.js';

const DIVISIONS_MIN = -24;
const DIVISIONS_MAX = 24;
const FRAMES_PER_DIVISION_MIN = 1;
const FRAMES_PER_DIVISION_MAX = 12;
const DIVISIONS_INITIAL = 8;
const FRAMES_PER_DIVISION_INITIAL = 4;

const maxHistoryOffset = Math.abs(DIVISIONS_MAX) * FRAMES_PER_DIVISION_MAX;
const HISTORY_SIZE = maxHistoryOffset + 1;

export default {
	name: 'Slow',
	hash: 'slow',
	controls: [['Number of segments'], ['Delay per segment']],
	controlValues: {
		x1: (DIVISIONS_INITIAL - DIVISIONS_MIN) / (DIVISIONS_MAX - DIVISIONS_MIN),
		y1:
			(FRAMES_PER_DIVISION_INITIAL - FRAMES_PER_DIVISION_MIN) /
			(FRAMES_PER_DIVISION_MAX - FRAMES_PER_DIVISION_MIN),
	},
	history: HISTORY_SIZE,
	maxTextureSize: 720,
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [helpers(), save(), autosize()],
		});
		shader.initializeUniform('u_divisions', 'int', DIVISIONS_INITIAL);
		shader.initializeUniform('u_framesPerDivision', 'int', FRAMES_PER_DIVISION_INITIAL);
		setShader(shader);
	},
	onUpdate({ x1, y1 }, shader) {
		let divisions = lerp(DIVISIONS_MIN, DIVISIONS_MAX, x1);
		divisions = Math.sign(divisions) * Math.ceil(Math.abs(divisions)); // Round away from zero.
		const framesPerDivision = Math.round(lerp(FRAMES_PER_DIVISION_MIN, FRAMES_PER_DIVISION_MAX, y1));
		shader.updateUniforms({
			u_divisions: divisions,
			u_framesPerDivision: framesPerDivision,
		});
	},
};
