import ShaderPad from 'shaderpad';
import face from 'shaderpad/plugins/face';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import { FaceLandmarker } from '@mediapipe/tasks-vision';

import fragmentShaderSrc from './wireface.glsl';
import { lerp } from '../util.js';

const LINE_WIDTH_MIN = 0;
const LINE_WIDTH_MAX = 6;
const LINE_WIDTH_INITIAL = 2;
const LINE_HUE_ROTATION_INITIAL = 0.78;
const DOT_HUE_ROTATION_INITIAL = 0.2;
const DOT_SIZE_MIN = 0;
const DOT_SIZE_MAX = 6;
const DOT_SIZE_INITIAL = 2;
const BACKGROUND_COLOR_INITIAL = 0.1;
let currentLineWidth = LINE_WIDTH_INITIAL;
let currentDotSize = DOT_SIZE_INITIAL;

const segments = FaceLandmarker.FACE_LANDMARKS_TESSELATION;

function renderLinesToCanvas(ctx, faceLandmarks, lineWidth, dotSize) {
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	if (!(lineWidth || dotSize) || !faceLandmarks?.length) return;

	ctx.lineWidth = lineWidth;
	ctx.beginPath();
	faceLandmarks.forEach(face => {
		if (face.length === 0) return;
		segments.forEach(segment => {
			const p0 = face[segment.start];
			const p1 = face[segment.end];
			ctx.beginPath();
			if (lineWidth > 0) {
				ctx.moveTo(p0.x * ctx.canvas.width, p0.y * ctx.canvas.height);
				ctx.lineTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
				ctx.stroke();
			}
			if (dotSize > 0) {
				ctx.beginPath();
				ctx.arc(p0.x * ctx.canvas.width, p0.y * ctx.canvas.height, dotSize, 0, 2 * Math.PI);
				ctx.fill();
			}
		});
	});
}

export default {
	name: 'Wireface',
	hash: 'wireface',
	controls: [
		['Line width', 'Dot size'],
		['Line color', 'Dot color', 'Background color'],
	],
	controlValues: {
		x1: (LINE_WIDTH_INITIAL - LINE_WIDTH_MIN) / (LINE_WIDTH_MAX - LINE_WIDTH_MIN),
		x2: (DOT_SIZE_INITIAL - DOT_SIZE_MIN) / (DOT_SIZE_MAX - DOT_SIZE_MIN),
		y1: LINE_HUE_ROTATION_INITIAL,
		y2: DOT_HUE_ROTATION_INITIAL,
		y3: BACKGROUND_COLOR_INITIAL,
	},
	initialize(setShader, canvas) {
		currentLineWidth = LINE_WIDTH_INITIAL;
		currentDotSize = DOT_SIZE_INITIAL;
		const lineCanvas = document.createElement('canvas');
		lineCanvas.width = lineCanvas.height = 1024;
		const lineCtx = lineCanvas.getContext('2d');
		lineCtx.globalCompositeOperation = 'lighter';
		lineCtx.strokeStyle = '#f00';
		lineCtx.fillStyle = '#0f0';

		const shader = new ShaderPad(fragmentShaderSrc, {
			canvas,
			plugins: [
				helpers(),
				save(),
				face({
					textureName: 'u_inputStream',
					options: { maxFaces: 3 },
				}),
			],
		});
		shader.on('face:result', results => {
			if (results.faceLandmarks) {
				renderLinesToCanvas(lineCtx, results.faceLandmarks, currentLineWidth, currentDotSize);
				shader.updateTextures({ u_faceMesh: lineCanvas });
			}
		});
		shader.initializeUniform('u_hueRotation', 'float', LINE_HUE_ROTATION_INITIAL);
		shader.initializeUniform('u_dotHueRotation', 'float', DOT_HUE_ROTATION_INITIAL);
		shader.initializeUniform('u_backgroundColor', 'float', BACKGROUND_COLOR_INITIAL);
		shader.initializeTexture('u_faceMesh', lineCanvas);

		setShader(shader);
	},
	onUpdate({ x1, x2, y1, y2, y3 }, shader) {
		currentLineWidth = lerp(LINE_WIDTH_MIN, LINE_WIDTH_MAX, x1);
		currentDotSize = lerp(DOT_SIZE_MIN, DOT_SIZE_MAX, x2);
		shader.updateUniforms({
			u_hueRotation: y1,
			u_dotHueRotation: y2,
			u_backgroundColor: y3,
		});
	},
};
