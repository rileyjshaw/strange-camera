// Credit: Inspired by https://www.reddit.com/r/generative/comments/1kddpwf/genuary_2025_day_31_pixel_sorting/

import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import positionShaderSrc from './sorted-positions.glsl';
import outputShaderSrc from './sorted-output.glsl';
import { lerp } from '../util.js';

const ANGLE_MIN = 0;
const ANGLE_MAX = Math.PI * 2;
const ANGLE_INITIAL = Math.PI * 0.75;

const THRESHOLD_MIN = 0.2;
const THRESHOLD_MAX = 2.0;
const THRESHOLD_INITIAL = 1.4;

const PIXEL_SIZE_MIN = 1;
const PIXEL_SIZE_MAX = 32;
const PIXEL_SIZE_INITIAL = 1;

const LOOK_DIST_MIN = 1;
const LOOK_DIST_MAX = 64;
const LOOK_DIST_INITIAL = 1;

let positionShader, outputShader;
let currentInput = null;

export default {
	name: 'Sorted',
	hash: 'sorted',
	controls: [
		['Sort angle', 'Pixel size'],
		['Threshold', 'Look distance'],
	],
	controlValues: {
		x1: (ANGLE_INITIAL - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN),
		y1: (THRESHOLD_INITIAL - THRESHOLD_MIN) / (THRESHOLD_MAX - THRESHOLD_MIN),
		x2: (PIXEL_SIZE_INITIAL - PIXEL_SIZE_MIN) / (PIXEL_SIZE_MAX - PIXEL_SIZE_MIN),
		y2: (LOOK_DIST_INITIAL - LOOK_DIST_MIN) / (LOOK_DIST_MAX - LOOK_DIST_MIN),
	},
	controlModifiers: {
		x1: {
			precision: 0.001,
			loop: true,
		},
	},
	initialize(setShader, canvas) {
		positionShader = new ShaderPad(positionShaderSrc, {
			canvas: { width: canvas.width, height: canvas.height },
			plugins: [helpers()],
			history: 1,
			internalFormat: 'R32UI',
			format: 'RED_INTEGER',
			type: 'UNSIGNED_INT',
			minFilter: 'NEAREST',
			magFilter: 'NEAREST',
		});

		outputShader = new ShaderPad(outputShaderSrc, {
			canvas,
			plugins: [helpers(), save(), autosize()],
		});

		positionShader.initializeUniform('u_sortAngle', 'float', ANGLE_INITIAL);
		positionShader.initializeUniform('u_threshold', 'float', THRESHOLD_INITIAL);
		positionShader.initializeUniform('u_pixelSize', 'int', PIXEL_SIZE_INITIAL);
		positionShader.initializeUniform('u_lookDist', 'int', LOOK_DIST_INITIAL);

		const positionMapTextureOptions = {
			internalFormat: 'R32UI',
			format: 'RED_INTEGER',
			type: 'UNSIGNED_INT',
			minFilter: 'NEAREST',
			magFilter: 'NEAREST',
		};

		outputShader.initializeTexture('u_positionMap', positionShader, positionMapTextureOptions);

		outputShader.on('autosize:resize', (width, height) => {
			positionShader.canvas.width = width;
			positionShader.canvas.height = height;
			positionShader.reset();
		});

		const composite = {
			initializeTexture(name, source, opts) {
				if (name === 'u_inputStream') {
					currentInput = source;
					positionShader.initializeTexture('u_inputStream', source);
					outputShader.initializeTexture('u_inputStream', source);
				}
			},
			updateTextures(updates) {
				if (updates?.u_inputStream) {
					currentInput = updates.u_inputStream;
				}
			},
			updateUniforms(u) {
				const updates = {};
				if (u.u_sortAngle !== undefined) updates.u_sortAngle = u.u_sortAngle;
				if (u.u_threshold !== undefined) updates.u_threshold = u.u_threshold;
				if (u.u_pixelSize !== undefined) updates.u_pixelSize = u.u_pixelSize;
				if (u.u_lookDist !== undefined) updates.u_lookDist = u.u_lookDist;
				positionShader.updateUniforms(updates);
			},
			play(cb) {
				outputShader.play(() => {
					cb();
					if (currentInput) {
						positionShader.updateTextures({ u_inputStream: currentInput });
						positionShader.step();
						outputShader.updateTextures(
							{
								u_inputStream: currentInput,
								u_positionMap: positionShader,
							},
							{
								u_positionMap: positionMapTextureOptions,
							}
						);
					}
				});
			},
			pause() {
				outputShader.pause(...arguments);
			},
			draw() {
				outputShader.draw(...arguments);
			},
			save() {
				outputShader.save(...arguments);
			},
			on() {
				outputShader.on(...arguments);
			},
			get canvas() {
				return outputShader.canvas;
			},
			destroy() {
				positionShader.destroy();
				outputShader.destroy();
				positionShader = outputShader = null;
			},
		};

		setShader(composite);
	},
	onUpdate({ x1, y1, x2, y2 }, shader) {
		const sortAngle = lerp(ANGLE_MIN, ANGLE_MAX, x1);
		const threshold = lerp(THRESHOLD_MIN, THRESHOLD_MAX, y1);
		const pixelSize = Math.round(lerp(PIXEL_SIZE_MIN, PIXEL_SIZE_MAX, x2));
		const lookDist = Math.round(lerp(LOOK_DIST_MIN, LOOK_DIST_MAX, y2));
		shader.updateUniforms({
			u_sortAngle: sortAngle,
			u_threshold: threshold,
			u_pixelSize: pixelSize,
			u_lookDist: lookDist,
		});
	},
};
