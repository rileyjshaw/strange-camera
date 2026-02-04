// Kaleidoscope scene – four scope shapes (equilateral, square, isosceles, scalene).
// Shader adapted from https://github.com/leifgehrmann/kaleidoscope.

import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './kaleidoscope.glsl';

const ROTATION_INITIAL = 0;
const MIN_SCALE = 0.01;
const MAX_SCALE = 2;
const SCALE_INITIAL = 0.5;
const SHAPE_INITIAL = 0.75; // 0=equilateral, 0.25=square, 0.5=isosceles, 0.75=scalene
const OFFSET_INITIAL = 0;

function shapeIndex(x1) {
	return Math.min(3, Math.floor((x1 ?? SHAPE_INITIAL) * 4));
}

function scaleZoom(t) {
	return MIN_SCALE * Math.pow(MAX_SCALE / MIN_SCALE, t ?? SCALE_INITIAL);
}

export default {
	name: 'Kaleidoscope',
	hash: 'kaleidoscope',
	controls: [
		['Shape', 'X offset', 'Rotation'],
		['Y offset', 'Scale'],
	],
	controlValues: {
		x1: SHAPE_INITIAL,
		x2: OFFSET_INITIAL,
		x3: ROTATION_INITIAL,
		y1: OFFSET_INITIAL,
		y2: SCALE_INITIAL,
	},
	controlModifiers: {
		x1: {
			precision: 0.002,
			loop: true,
		},
		x2: {
			loop: true,
		},
		x3: {
			precision: 0.0008,
			loop: true,
		},
		y1: {
			loop: true,
		},
	},
	initialize(setShader, canvas) {
		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [helpers(), save(), autosize()],
		});
		shader.initializeUniform('u_rotation', 'float', ROTATION_INITIAL);
		shader.initializeUniform('u_scale', 'float', scaleZoom(SCALE_INITIAL));
		shader.initializeUniform('u_scopeShape', 'int', shapeIndex(SHAPE_INITIAL));
		shader.initializeUniform('u_offset', 'float', [OFFSET_INITIAL, OFFSET_INITIAL]);
		setShader(shader);
	},
	onUpdate({ x1, x2, x3, y1, y2 }, shader) {
		shader.updateUniforms({
			u_rotation: x3,
			u_scale: scaleZoom(y2),
			u_scopeShape: shapeIndex(x1),
			u_offset: [x2, y1],
		});
	},
};
