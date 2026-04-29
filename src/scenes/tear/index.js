import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';

import fragmentShaderSrc from './tear.glsl';
import { normalize, lerp } from '../util.js';

const { PI } = Math;

const INITIAL_ANGLE_MIN = 0;
const INITIAL_ANGLE_MAX = PI;
const INITIAL_ANGLE_INITIAL = PI / 2;
const ANGLE_INCREMENT_MIN = -PI / 2;
const ANGLE_INCREMENT_MAX = PI / 2;
const ANGLE_INCREMENT_INITIAL = 0;
const JITTER_MIN = 0;
const JITTER_MAX = PI / 4;
const JITTER_INITIAL = PI / 12;
const ROUGHNESS_MIN = 0;
const ROUGHNESS_MAX = 0.75;
const ROUGHNESS_INITIAL = 0.4;
const WIDTH_MIN = 4;
const WIDTH_MAX = 180;
const WIDTH_INITIAL = 42;
const SPEED_MIN = 0.5;
const SPEED_MAX = 1;
const SPEED_INITIAL = 0.75;

function controlValuesToUniforms({ x1, x2, x3, y1, y2, y3 }) {
	return {
		u_initialAngle: lerp(INITIAL_ANGLE_MIN, INITIAL_ANGLE_MAX, x1),
		u_angleIncrement: lerp(ANGLE_INCREMENT_MIN, ANGLE_INCREMENT_MAX, x2),
		u_jitter: lerp(JITTER_MIN, JITTER_MAX, x3),
		u_roughness: lerp(ROUGHNESS_MIN, ROUGHNESS_MAX, y1),
		u_width: lerp(WIDTH_MIN, WIDTH_MAX, y2),
		u_speed: lerp(SPEED_MIN, SPEED_MAX, y3),
	};
}

export default {
	name: 'Tear',
	hash: 'tear',
	controls: [
		['Initial angle', 'Angle increment', 'Jitter'],
		['Roughness', 'Width', 'Speed'],
	],
	controlValues: {
		x1: normalize(INITIAL_ANGLE_MIN, INITIAL_ANGLE_MAX, INITIAL_ANGLE_INITIAL),
		x2: normalize(ANGLE_INCREMENT_MIN, ANGLE_INCREMENT_MAX, ANGLE_INCREMENT_INITIAL),
		x3: normalize(JITTER_MIN, JITTER_MAX, JITTER_INITIAL),
		y1: normalize(ROUGHNESS_MIN, ROUGHNESS_MAX, ROUGHNESS_INITIAL),
		y2: normalize(WIDTH_MIN, WIDTH_MAX, WIDTH_INITIAL),
		y3: normalize(SPEED_MIN, SPEED_MAX, SPEED_INITIAL),
	},
	controlModifiers: {
		x1: { precision: 0.0008, loop: true },
		x2: { precision: 0.0008, loop: true },
	},
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [helpers()],
			history: 1,
		});

		const initialUniforms = controlValuesToUniforms({
			x1: this.controlValues.x1,
			x2: this.controlValues.x2,
			x3: this.controlValues.x3,
			y1: this.controlValues.y1,
			y2: this.controlValues.y2,
			y3: this.controlValues.y3,
		});
		for (const [name, value] of Object.entries(initialUniforms)) {
			shader.initializeUniform(name, 'float', value);
		}
		setShader(shader);
	},
	onUpdate(controlValues, shader) {
		shader.updateUniforms(controlValuesToUniforms(controlValues));
	},
};
