import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import scoreShaderSrc from './sorted-1-scores.glsl';
import proposalShaderSrc from './sorted-2-proposal.glsl';
import acceptShaderSrc from './sorted-3-accept.glsl';
import positionShaderSrc from './sorted-4-positions.glsl';
import outputShaderSrc from './sorted-5-output.glsl';
import helperShaderSrc from './sorted-helpers.glsl';
import { lerp, normalize } from '../util.js';

const ITERATIONS_MIN = 1;
const ITERATIONS_MAX = 8;
const ITERATIONS_INITIAL = 1;

const THRESHOLD_MIN = 0.2;
const THRESHOLD_MAX = 4.0;
const THRESHOLD_INITIAL = 4.0;

const LOOK_DIST_MIN = 1;
const LOOK_DIST_MAX = 256;
const LOOK_DIST_INITIAL = 1;

const HEURISTIC_INITIAL = 0.025;

const ANGLE_MIN = 0;
const ANGLE_MAX = Math.PI * 2;
const ANGLE_INITIAL = Math.PI * 0.75;

const PIXEL_POWER_MIN = 1;
const PIXEL_POWER_MAX = 8;
const PIXEL_POWER_INITIAL = 1;

let scoreShader, proposalShader, acceptShader, positionShader, outputShader;
let currentInput = null;
let iterations = ITERATIONS_INITIAL;
let pixelSize = Math.pow(2, PIXEL_POWER_INITIAL);
let isPendingPositionReinit = false;
let activeCellsX = -1;
let activeCellsY = -1;
let canvasWidth = -1;
let canvasHeight = -1;

function withSortedHelpers(shaderSource) {
	const firstLineBreakIdx = shaderSource.indexOf('\n');
	if (firstLineBreakIdx < 0) return `${shaderSource}\n${helperShaderSrc}`;
	return `${shaderSource.slice(0, firstLineBreakIdx + 1)}\n${helperShaderSrc}\n${shaderSource.slice(
		firstLineBreakIdx + 1
	)}`;
}

function getActiveCells(width, height, nextPixelSize) {
	return {
		x: Math.max(0, Math.floor(width / nextPixelSize)),
		y: Math.max(0, Math.floor(height / nextPixelSize)),
	};
}

export default {
	name: 'Sorted',
	hash: 'sorted',
	controls: [
		['Iterations', 'Swap similarity', 'Look distance'],
		['Heuristic', 'Sort angle', 'Pixel size'],
	],
	controlValues: {
		x1: normalize(ITERATIONS_MIN, ITERATIONS_MAX, ITERATIONS_INITIAL),
		x2: normalize(THRESHOLD_MIN, THRESHOLD_MAX, THRESHOLD_INITIAL),
		x3: normalize(LOOK_DIST_MIN, LOOK_DIST_MAX, LOOK_DIST_INITIAL),
		y1: HEURISTIC_INITIAL,
		y2: normalize(ANGLE_MIN, ANGLE_MAX, ANGLE_INITIAL),
		y3: normalize(PIXEL_POWER_MIN, PIXEL_POWER_MAX, PIXEL_POWER_INITIAL),
	},
	controlModifiers: {
		x1: {
			precision: 0.001,
		},
		y2: {
			precision: 0.001,
			loop: true,
		},
	},
	initialize(setShader, canvas) {
		iterations = ITERATIONS_INITIAL;
		pixelSize = Math.pow(2, PIXEL_POWER_INITIAL);
		isPendingPositionReinit = false;
		activeCellsX = -1;
		activeCellsY = -1;
		canvasWidth = canvas.width;
		canvasHeight = canvas.height;
		const activeCells = getActiveCells(canvas.width, canvas.height, pixelSize);
		const chainOpts = { canvas, plugins: [helpers()] };

		scoreShader = new ShaderPad(withSortedHelpers(scoreShaderSrc), {
			...chainOpts,
			internalFormat: 'RG16I',
			format: 'RG_INTEGER',
			type: 'SHORT',
			minFilter: 'NEAREST',
			magFilter: 'NEAREST',
		});

		proposalShader = new ShaderPad(withSortedHelpers(proposalShaderSrc), {
			...chainOpts,
			internalFormat: 'RG32I',
			format: 'RG_INTEGER',
			type: 'INT',
			minFilter: 'NEAREST',
			magFilter: 'NEAREST',
		});

		acceptShader = new ShaderPad(withSortedHelpers(acceptShaderSrc), {
			...chainOpts,
			internalFormat: 'R32UI',
			format: 'RED_INTEGER',
			type: 'UNSIGNED_INT',
			minFilter: 'NEAREST',
			magFilter: 'NEAREST',
		});

		positionShader = new ShaderPad(withSortedHelpers(positionShaderSrc), {
			...chainOpts,
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

		scoreShader.initializeUniform('u_heuristic', 'float', HEURISTIC_INITIAL);
		proposalShader.initializeUniform('u_heuristic', 'float', HEURISTIC_INITIAL);
		positionShader.initializeUniform('u_heuristic', 'float', HEURISTIC_INITIAL);
		scoreShader.initializeUniform('u_sortAngle', 'float', ANGLE_INITIAL);
		scoreShader.initializeUniform('u_threshold', 'float', THRESHOLD_INITIAL);

		for (const s of [scoreShader, proposalShader, acceptShader, positionShader]) {
			s.initializeUniform('u_pixelSize', 'int', pixelSize);
			s.initializeUniform('u_lookDist', 'int', LOOK_DIST_INITIAL);
		}

		for (const s of [scoreShader, proposalShader, acceptShader, positionShader]) {
			s.initializeUniform('u_activeCellsX', 'int', activeCells.x);
			s.initializeUniform('u_activeCellsY', 'int', activeCells.y);
		}

		scoreShader.initializeTexture('u_positionMap', positionShader);
		proposalShader.initializeTexture('u_scoreMap', scoreShader);
		proposalShader.initializeTexture('u_positionMap', positionShader);
		acceptShader.initializeTexture('u_proposalTex', proposalShader);
		positionShader.initializeTexture('u_proposalTex', proposalShader);
		positionShader.initializeTexture('u_acceptTex', acceptShader);
		outputShader.initializeTexture('u_positionMap', positionShader);

		function setBufferDimensions(width, height) {
			if (canvasWidth !== width || canvasHeight !== height) {
				canvasWidth = width;
				canvasHeight = height;
				isPendingPositionReinit = true;
			}
		}

		function updateActiveCellsUniforms(width, height, nextPixelSize) {
			const nextActiveCells = getActiveCells(width, height, nextPixelSize);
			if (nextActiveCells.x === activeCellsX && nextActiveCells.y === activeCellsY) {
				return;
			}

			activeCellsX = nextActiveCells.x;
			activeCellsY = nextActiveCells.y;

			scoreShader.updateUniforms({
				u_activeCellsX: nextActiveCells.x,
				u_activeCellsY: nextActiveCells.y,
			});
			proposalShader.updateUniforms({
				u_activeCellsX: nextActiveCells.x,
				u_activeCellsY: nextActiveCells.y,
			});
			acceptShader.updateUniforms({
				u_activeCellsX: nextActiveCells.x,
				u_activeCellsY: nextActiveCells.y,
			});
			positionShader.updateUniforms({
				u_activeCellsX: nextActiveCells.x,
				u_activeCellsY: nextActiveCells.y,
			});
		}

		setBufferDimensions(canvas.width, canvas.height);
		updateActiveCellsUniforms(canvas.width, canvas.height, pixelSize);

		positionShader.step();
		positionShader.step();

		const composite = {
			initializeTexture(name, source) {
				if (name === 'u_inputStream') {
					currentInput = source;
					scoreShader.initializeTexture('u_inputStream', source);
					proposalShader.initializeTexture('u_inputStream', source);
					outputShader.initializeTexture('u_inputStream', source);
				}
			},
			updateTextures(updates) {
				if (updates?.u_inputStream) {
					currentInput = updates.u_inputStream;
				}
			},
			updateUniforms(updates) {
				scoreShader.updateUniforms(updates);
				proposalShader.updateUniforms(updates);
				acceptShader.updateUniforms(updates);
				positionShader.updateUniforms(updates);
				outputShader.updateUniforms(updates);
			},
			play(cb) {
				outputShader.play(() => {
					cb();
					setBufferDimensions(canvas.width, canvas.height);
					updateActiveCellsUniforms(canvas.width, canvas.height, pixelSize);
					if (isPendingPositionReinit) {
						isPendingPositionReinit = false;
						proposalShader.resetFrame();
						acceptShader.resetFrame();
						positionShader.reset();
						positionShader.step();
						positionShader.step();
					}
					if (currentInput) {
						for (let i = 0; i < iterations; ++i) {
							scoreShader.updateTextures({
								u_inputStream: currentInput,
								u_positionMap: positionShader,
							});
							scoreShader.step();

							proposalShader.updateTextures({
								u_scoreMap: scoreShader,
								u_inputStream: currentInput,
								u_positionMap: positionShader,
							});
							proposalShader.step();

							acceptShader.updateTextures({ u_proposalTex: proposalShader });
							acceptShader.step();

							positionShader.updateTextures({
								u_proposalTex: proposalShader,
								u_acceptTex: acceptShader,
							});
							positionShader.step();
						}

						outputShader.updateTextures({
							u_inputStream: currentInput,
							u_positionMap: positionShader,
						});
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
				scoreShader.destroy();
				proposalShader.destroy();
				acceptShader.destroy();
				positionShader.destroy();
				outputShader.destroy();
				scoreShader = proposalShader = acceptShader = positionShader = outputShader = null;
				currentInput = null;
				canvasWidth = -1;
				canvasHeight = -1;
			},
		};

		setShader(composite);
	},
	onUpdate({ x1, x2, x3, y1, y2, y3 }, shader) {
		iterations = Math.round(lerp(ITERATIONS_MIN, ITERATIONS_MAX, x1));
		const newPixelSize = Math.pow(2, Math.round(lerp(PIXEL_POWER_MIN, PIXEL_POWER_MAX, y3)));
		if (newPixelSize !== pixelSize) {
			isPendingPositionReinit = true;
		}
		pixelSize = newPixelSize;
		shader.updateUniforms({
			u_threshold: lerp(THRESHOLD_MIN, THRESHOLD_MAX, x2),
			u_lookDist: Math.round(lerp(LOOK_DIST_MIN, LOOK_DIST_MAX, x3)),
			u_heuristic: y1,
			u_sortAngle: lerp(ANGLE_MIN, ANGLE_MAX, y2),
			u_pixelSize: pixelSize,
		});
	},
};
