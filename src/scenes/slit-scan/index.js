import ShaderPad from 'shaderpad';
import helpers from 'shaderpad/plugins/helpers';

import scanShaderSrc from './scan.glsl';
import overlayShaderSrc from './slit-scan.glsl';
import { lerp } from '../util.js';

const SPEED_MIN = 0.03;
const SPEED_MAX = 1.0;

const INITIAL_ROTATION = 0.25;
const INITIAL_SPEED = 0.15;

let scanShader;
let overlayShader;
let currentInput = null;
let angle, speed;
let pos = 0;
let lastUpdateTime = null;

export default {
	name: 'Slit Scan',
	hash: 'slit-scan',
	controls: [['Rotation'], ['Speed']],
	controlValues: { x1: INITIAL_ROTATION, y1: INITIAL_SPEED },
	controlModifiers: {
		x1: { loop: true },
	},
	initialize(setShader, canvas) {
		angle = INITIAL_ROTATION * Math.PI * 2;
		speed = lerp(SPEED_MIN, SPEED_MAX, INITIAL_SPEED);
		pos = 0;
		lastUpdateTime = null;
		currentInput = null;

		scanShader = new ShaderPad(scanShaderSrc, {
			canvas,
			plugins: [helpers()],
			history: 1,
		});

		overlayShader = new ShaderPad(overlayShaderSrc, {
			canvas,
			plugins: [helpers()],
		});

		scanShader.initializeUniform('u_angle', 'float', angle);
		scanShader.initializeUniform('u_posFrom', 'float', pos);
		scanShader.initializeUniform('u_posTo', 'float', pos);

		overlayShader.initializeUniform('u_angle', 'float', angle);
		overlayShader.initializeUniform('u_pos', 'float', pos);
		overlayShader.initializeTexture('u_scan', scanShader);

		scanShader.on('preStep', time => {
			if (lastUpdateTime === null) lastUpdateTime = time;
			const dt = time - lastUpdateTime;
			lastUpdateTime = time;

			const posTo = (((pos + speed * dt) % 1.0) + 1.0) % 1.0;
			scanShader.updateUniforms({
				u_posFrom: pos,
				u_posTo: posTo,
			});
			overlayShader.updateUniforms({ u_pos: posTo });
			pos = posTo;
		});

		setShader({
			initializeTexture(name, source, opts) {
				if (name === 'u_inputStream') {
					currentInput = source;
					scanShader.initializeTexture(name, source, opts);
				}
			},
			updateTextures(updates) {
				if (updates?.u_inputStream) {
					currentInput = updates.u_inputStream;
					scanShader.updateTextures({ u_inputStream: currentInput });
				}
			},
			updateUniforms() {},
			play(cb) {
				overlayShader.play(() => {
					cb();
					scanShader.step();
					overlayShader.updateTextures({ u_scan: scanShader });
				});
			},
			pause() {
				overlayShader.pause(...arguments);
			},
			draw() {
				scanShader.draw(...arguments);
			},
			on() {
				overlayShader.on(...arguments);
			},
			off() {
				overlayShader.off(...arguments);
			},
			resize(width, height) {
				overlayShader.emit('autosize:resize', width, height);
				scanShader.emit('autosize:resize', width, height);
			},
			get canvas() {
				return overlayShader.canvas;
			},
			destroy() {
				scanShader?.destroy();
				overlayShader?.destroy();
				scanShader = null;
				overlayShader = null;
				currentInput = null;
				lastUpdateTime = null;
			},
		});
	},
	onUpdate({ x1, y1 }) {
		angle = x1 * Math.PI * 2;
		speed = lerp(SPEED_MIN, SPEED_MAX, y1);
		scanShader?.updateUniforms({ u_angle: angle });
		overlayShader?.updateUniforms({ u_angle: angle });
	},
};
