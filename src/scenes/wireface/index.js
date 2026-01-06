import ShaderPad from 'shaderpad';
import face from 'shaderpad/plugins/face';
import helpers from 'shaderpad/plugins/helpers';
import save from 'shaderpad/plugins/save';
import { FaceLandmarker } from '@mediapipe/tasks-vision';

import fragmentShaderSrc from './wireface.glsl';

const LINE_WIDTH_MIN = 0;
const LINE_WIDTH_MAX = 6;
const LINE_WIDTH_INITIAL = 1;
const HUE_ROTATION_INITIAL = 0.3;
const BACKGROUND_COLOR_INITIAL = 0.1;
let currentLineWidth = LINE_WIDTH_INITIAL;

const segments = FaceLandmarker.FACE_LANDMARKS_TESSELATION;

function renderLinesToCanvas(ctx, faceLandmarks, lineWidth) {
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	if (!lineWidth || !faceLandmarks?.length) return;

	ctx.strokeStyle = '#fff';
	ctx.lineWidth = lineWidth;
	ctx.beginPath();
	faceLandmarks.forEach(face => {
		if (face.length === 0) return;
		segments.forEach(segment => {
			const p0 = face[segment.start];
			const p1 = face[segment.end];

			ctx.moveTo(p0.x * ctx.canvas.width, p0.y * ctx.canvas.height);
			ctx.lineTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
		});
	});
	ctx.stroke();
}

export default {
	name: 'Wireface',
	hash: 'wireface',
	controls: [['Line width'], ['Mask color', 'Background color']],
	controlValues: {
		x1: (LINE_WIDTH_INITIAL - LINE_WIDTH_MIN) / (LINE_WIDTH_MAX - LINE_WIDTH_MIN),
		y1: HUE_ROTATION_INITIAL,
		y2: BACKGROUND_COLOR_INITIAL,
	},
	initialize(setShader) {
		currentLineWidth = LINE_WIDTH_INITIAL;
		const lineCanvas = document.createElement('canvas');
		lineCanvas.width = lineCanvas.height = 512;
		const lineCtx = lineCanvas.getContext('2d');

		const shader = new ShaderPad(fragmentShaderSrc, {
			plugins: [
				helpers(),
				save(),
				face({
					textureName: 'u_inputStream',
					options: {
						maxFaces: 3,
						onResults: results => {
							if (results.faceLandmarks) {
								renderLinesToCanvas(lineCtx, results.faceLandmarks, currentLineWidth);
								shader.updateTextures({ u_faceMesh: lineCanvas });
							}
						},
					},
				}),
			],
		});

		shader.initializeUniform('u_hueRotation', 'float', HUE_ROTATION_INITIAL);
		shader.initializeUniform('u_backgroundColor', 'float', BACKGROUND_COLOR_INITIAL);
		shader.initializeTexture('u_faceMesh', lineCanvas);

		setShader(shader);
	},
	onUpdate({ x1, y1, y2 }, shader) {
		currentLineWidth = LINE_WIDTH_MIN + x1 * (LINE_WIDTH_MAX - LINE_WIDTH_MIN);
		shader.updateUniforms({
			u_hueRotation: y1,
			u_backgroundColor: y2,
		});
	},
};
