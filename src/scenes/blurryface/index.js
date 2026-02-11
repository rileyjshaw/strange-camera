import ShaderPad from 'shaderpad';
import segmenter from 'shaderpad/plugins/segmenter';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './blurryface.glsl';
import kawaseDownSrc from './kawase-down.glsl';
import kawaseUpSrc from './kawase-up.glsl';
import { lerp } from '../util.js';

const BLUR_OFFSET_MIN = 0.5;
const BLUR_OFFSET_MAX = 4.0;
const BLUR_OFFSET_INITIAL = 2.0;
const KAWASE_PASSES = 5;
const MASK_HISTORY = 2;
const MODE_INITIAL = 1.0;

let downShaders = [];
let upShaders = [];
let mainShader;
let currentInput = null;

function computeLevelSizes(w, h) {
	const sizes = [{ w, h }];
	for (let i = 0; i < KAWASE_PASSES; i++) {
		const prev = sizes[sizes.length - 1];
		sizes.push({
			w: Math.max(1, Math.floor(prev.w / 2)),
			h: Math.max(1, Math.floor(prev.h / 2)),
		});
	}
	return sizes;
}

export default {
	name: 'Blurryface',
	hash: 'blurryface',
	controls: [['Blur amount'], ['Mode']],
	controlValues: {
		x1: (BLUR_OFFSET_INITIAL - BLUR_OFFSET_MIN) / (BLUR_OFFSET_MAX - BLUR_OFFSET_MIN),
		y1: MODE_INITIAL,
	},
	pluginReadyEvents: ['segmenter:ready'],
	initialize(setShader, canvas) {
		const w = canvas.width;
		const h = canvas.height;
		const sizes = computeLevelSizes(w, h);

		downShaders = [];
		for (let i = 0; i < KAWASE_PASSES; i++) {
			const s = sizes[i + 1];
			const shader = new ShaderPad(kawaseDownSrc, {
				canvas: { width: s.w, height: s.h },
				plugins: [helpers()],
			});
			shader.initializeUniform('u_offset', 'float', BLUR_OFFSET_INITIAL);
			downShaders.push(shader);
		}

		upShaders = [];
		for (let i = KAWASE_PASSES - 2; i >= 0; i--) {
			const s = sizes[i + 1];
			const shader = new ShaderPad(kawaseUpSrc, {
				canvas: { width: s.w, height: s.h },
				plugins: [helpers()],
			});
			shader.initializeUniform('u_offset', 'float', BLUR_OFFSET_INITIAL);
			upShaders.push(shader);
		}

		for (let i = 1; i < downShaders.length; i++) {
			downShaders[i].initializeTexture('u_input', downShaders[i - 1]);
		}

		upShaders[0].initializeTexture('u_input', downShaders[downShaders.length - 1]);
		for (let i = 1; i < upShaders.length; i++) {
			upShaders[i].initializeTexture('u_input', upShaders[i - 1]);
		}

		mainShader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [
				helpers(),
				save(),
				autosize(),
				segmenter({
					textureName: 'u_inputStream',
					options: { history: MASK_HISTORY },
				}),
			],
		});
		mainShader.initializeUniform('u_mode', 'float', MODE_INITIAL);
		mainShader.initializeTexture('u_blurred', upShaders[upShaders.length - 1]);

		mainShader.on('autosize:resize', (width, height) => {
			const newSizes = computeLevelSizes(width, height);
			for (let i = 0; i < KAWASE_PASSES; i++) {
				const s = newSizes[i + 1];
				downShaders[i].canvas.width = s.w;
				downShaders[i].canvas.height = s.h;
			}
			for (let j = 0; j < upShaders.length; j++) {
				const level = KAWASE_PASSES - 2 - j;
				const s = newSizes[level + 1];
				upShaders[j].canvas.width = s.w;
				upShaders[j].canvas.height = s.h;
			}
		});

		const composite = {
			initializeTexture(name, source, opts) {
				if (name === 'u_inputStream') currentInput = source;
				mainShader.initializeTexture(name, source, opts);
				downShaders[0].initializeTexture('u_input', source);
			},
			updateTextures(updates, opts) {
				if (updates && updates.u_inputStream) currentInput = updates.u_inputStream;
				mainShader.updateTextures(updates, opts);
			},
			updateUniforms(u) {
				mainShader.updateUniforms({ u_mode: u.u_mode });
				if (u.u_offset !== undefined) {
					for (const s of downShaders) s.updateUniforms({ u_offset: u.u_offset });
					for (const s of upShaders) s.updateUniforms({ u_offset: u.u_offset });
				}
			},
			play(cb) {
				mainShader.play(() => {
					cb();
					if (currentInput) {
						downShaders[0].updateTextures({ u_input: currentInput });
						downShaders[0].step();
						for (let i = 1; i < downShaders.length; i++) {
							downShaders[i].updateTextures({ u_input: downShaders[i - 1] });
							downShaders[i].step();
						}
						upShaders[0].updateTextures({
							u_input: downShaders[downShaders.length - 1],
						});
						upShaders[0].step();
						for (let i = 1; i < upShaders.length; i++) {
							upShaders[i].updateTextures({ u_input: upShaders[i - 1] });
							upShaders[i].step();
						}
						mainShader.updateTextures({
							u_blurred: upShaders[upShaders.length - 1],
						});
					}
				});
			},
			pause() {
				mainShader.pause(...arguments);
			},
			draw() {
				mainShader.draw(...arguments);
			},
			save() {
				mainShader.save(...arguments);
			},
			on() {
				mainShader.on(...arguments);
			},
			get canvas() {
				return mainShader.canvas;
			},
			destroy() {
				for (const s of downShaders) s.destroy();
				for (const s of upShaders) s.destroy();
				mainShader.destroy();
				downShaders = [];
				upShaders = [];
				mainShader = null;
			},
		};

		setShader(composite);
	},
	onUpdate({ x1, y1 }, shader) {
		const u_offset = lerp(BLUR_OFFSET_MIN, BLUR_OFFSET_MAX, x1);
		shader.updateUniforms({
			u_offset,
			u_mode: y1,
		});
	},
};
