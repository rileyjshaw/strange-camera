import ShaderPad from 'shaderpad';
import segmenter from 'shaderpad/plugins/segmenter';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import autosize from 'shaderpad/plugins/autosize';

import fragmentShaderSrc from './blurryface.glsl';
import blurHSrc from './blur-horizontal.glsl';
import blurVSrc from './blur-vertical.glsl';
import { lerp } from '../util.js';

const BLUR_RADIUS_MIN = 1;
const BLUR_RADIUS_MAX = 32;
const BLUR_RADIUS_INITIAL = 16;
const BLUR_DOWNSAMPLE = 4;
const MASK_HISTORY = 2;
const MODE_INITIAL = 1.0;

let blurH, blurV, mainShader;
let currentInput = null;

export default {
	name: 'Blurryface',
	hash: 'blurryface',
	controls: [['Blur amount'], ['Mode']],
	controlValues: {
		x1: (BLUR_RADIUS_INITIAL - BLUR_RADIUS_MIN) / (BLUR_RADIUS_MAX - BLUR_RADIUS_MIN),
		y1: MODE_INITIAL,
	},
	initialize(setShader, canvas) {
		const w = canvas.width;
		const h = canvas.height;
		const blurW = Math.max(1, Math.floor(w / BLUR_DOWNSAMPLE));
		const blurH_ = Math.max(1, Math.floor(h / BLUR_DOWNSAMPLE));

		blurH = new ShaderPad(blurHSrc, {
			canvas: { width: blurW, height: blurH_ },
			plugins: [helpers()],
		});
		blurV = new ShaderPad(blurVSrc, {
			canvas: { width: blurW, height: blurH_ },
			plugins: [helpers()],
		});
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

		blurH.initializeUniform('u_radius', 'float', BLUR_RADIUS_INITIAL);
		blurV.initializeUniform('u_radius', 'float', BLUR_RADIUS_INITIAL);
		mainShader.initializeUniform('u_mode', 'float', MODE_INITIAL);

		blurV.initializeTexture('u_input', blurH);
		mainShader.initializeTexture('u_blurred', blurV);

		mainShader.on('autosize:resize', (width, height) => {
			const bw = Math.max(1, Math.floor(width / BLUR_DOWNSAMPLE));
			const bh = Math.max(1, Math.floor(height / BLUR_DOWNSAMPLE));
			blurH.canvas.width = bw;
			blurH.canvas.height = bh;
			blurV.canvas.width = bw;
			blurV.canvas.height = bh;
		});

		const composite = {
			initializeTexture(name, source, opts) {
				if (name === 'u_inputStream') currentInput = source;
				mainShader.initializeTexture(name, source, opts);
				blurH.initializeTexture('u_input', source);
			},
			updateTextures(updates, opts) {
				if (updates && updates.u_inputStream) currentInput = updates.u_inputStream;
				mainShader.updateTextures(updates, opts);
			},
			updateUniforms(u) {
				mainShader.updateUniforms({ u_mode: u.u_mode });
				if (u.u_blurRadius !== undefined) {
					blurH.updateUniforms({ u_radius: u.u_blurRadius });
					blurV.updateUniforms({ u_radius: u.u_blurRadius });
				}
			},
			play(cb) {
				mainShader.play(() => {
					cb();
					if (currentInput) {
						blurH.updateTextures({ u_input: currentInput });
						blurH.step();
						blurV.updateTextures({ u_input: blurH });
						blurV.step();
						mainShader.updateTextures({ u_blurred: blurV });
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
				blurH.destroy();
				blurV.destroy();
				mainShader.destroy();
				blurH = blurV = mainShader = null;
			},
		};

		setShader(composite);
	},
	onUpdate({ x1, y1 }, shader) {
		const u_blurRadius = lerp(BLUR_RADIUS_MIN, BLUR_RADIUS_MAX, x1);
		shader.updateUniforms({
			u_blurRadius,
			u_mode: y1,
		});
	},
};
