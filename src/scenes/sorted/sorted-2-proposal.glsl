#version 300 es
// Pass 2 — Proposal: proposers (parity 0) choose best swap direction.

precision highp float;
precision highp int;

in vec2 v_uv;
out ivec4 outColor;

uniform highp isampler2D u_scoreMap;
uniform sampler2D u_inputStream;
uniform highp usampler2D u_positionMap;
uniform float u_heuristic;
uniform int u_pixelSize;
uniform int u_lookDist;
uniform int u_frame;
uniform int u_activeCellsX;
uniform int u_activeCellsY;

const float SCORE_SCALE = 32767.0;
const float PRIORITY_SCALE = 1e8;

ivec2 getMappedPos(ivec2 coord) {
	ivec2 positionSize = textureSize(u_positionMap, 0);
	if (!inBounds(coord, positionSize))
		return ivec2(-1);
	uint idx = texelFetch(u_positionMap, coord, 0).r;
	uint maxIdx = uint(positionSize.x * positionSize.y);
	if (idx >= maxIdx) return ivec2(-1);
	return decodePos(idx, positionSize);
}

vec3 rgb2hsv(vec3 c) {
	const vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	const float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

float colorValue(vec4 color) {
	vec3 hsv = rgb2hsv(color.rgb);
	hsv.x = floor(hsv.x * 15.0) / 15.0;
	return hsv.z > 0.5 ? hsv.x + hsv.z : -hsv.x + hsv.z;
}

float sampleColorValueAtScreen(ivec2 screenCoord) {
	ivec2 canvasSize = ivec2(u_resolution);
	if (!inBounds(screenCoord, canvasSize)) return 0.0;
	ivec2 mappedPos = getMappedPos(screenCoord);
	if (!inBounds(mappedPos, canvasSize)) mappedPos = screenCoord;
	vec2 canvasUv = (vec2(mappedPos) + 0.5) / vec2(canvasSize);
	vec2 inputSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(canvasUv, inputSize);
	return colorValue(texture(u_inputStream, uv));
}

float tieBreak(ivec2 cell, int dir) {
	float h = fract(sin(float(cell.x * 1237 + cell.y * 3571 + dir * 997)) * 43758.5453);
	return h * 1e-5;
}

void main() {
	ivec2 activeCells = ivec2(u_activeCellsX, u_activeCellsY);
	ivec2 screenCoord = ivec2(gl_FragCoord.xy);
	ivec2 cellCoord = getCellFromScreen(screenCoord, u_pixelSize);
	ivec2 cellAnchor = cellToScreenAnchor(cellCoord, u_pixelSize);

	if (!isCellInBounds(cellCoord, activeCells) || screenCoord != cellAnchor) {
		outColor = ivec4(0, SORT_DIR_NONE, 0, 1);
		return;
	}

	int phase = u_frame & 1;
	int parity = (cellCoord.x + cellCoord.y + phase) & 1;

	if (parity != 0) {
		outColor = ivec4(0, SORT_DIR_NONE, 0, 1);
		return;
	}

	ivec2 myRG = texelFetch(u_scoreMap, cellAnchor, 0).rg;

	float scores[4];
	scores[0] = float(myRG.r) / SCORE_SCALE;
	scores[2] = float(myRG.g) / SCORE_SCALE;

	int distX = wrapLookDistAxis(u_lookDist, activeCells.x);
	int distY = wrapLookDistAxis(u_lookDist, activeCells.y);
	ivec2 rightNeighbor = wrapCellCoord(cellCoord + ivec2(distX, 0), activeCells);
	ivec2 downNeighbor = wrapCellCoord(cellCoord + ivec2(0, distY), activeCells);
	scores[1] = distX > 0
		? float(texelFetch(u_scoreMap, cellToScreenAnchor(rightNeighbor, u_pixelSize), 0).r) / SCORE_SCALE
		: 0.0;
	scores[3] = distY > 0
		? float(texelFetch(u_scoreMap, cellToScreenAnchor(downNeighbor, u_pixelSize), 0).g) / SCORE_SCALE
		: 0.0;

	ivec2 sampleCoord = cellToScreenSample(cellCoord, u_pixelSize);
	ivec2 mappedPos = getMappedPos(sampleCoord);
	bool proposerAtHome = inBounds(mappedPos, ivec2(u_resolution)) && mappedPos == sampleCoord;
	float proposerColorValue = sampleColorValueAtScreen(sampleCoord);
	float proposerColorTie = clamp((proposerColorValue + 2.0) * 0.25, 0.0, 1.0);

	int bestDir = SORT_DIR_NONE;
	float bestPriority = -1e20;
	bool foundPositive = false;
	int fallbackDir = SORT_DIR_NONE;
	float fallbackPriority = -1e20;

	for (int i = 0; i < 4; i++) {
		int dist = wrapLookDistForDir(i, u_lookDist, activeCells);
		if (dist <= 0) continue;
		float score = scores[i];
		float priority = score + proposerColorTie * 1e-6 + tieBreak(cellCoord, i) * 1e-8;
		if (priority > fallbackPriority) {
			fallbackPriority = priority;
			fallbackDir = i;
		}
		if (score > 0.0) {
			foundPositive = true;
			if (priority > bestPriority) {
				bestDir = i;
				bestPriority = priority;
			}
		}
	}

	if (!foundPositive) {
		float forceSwap = smoothstep(0.85, 1.0, u_heuristic);
		float forceRoll = fract(sin(float(cellCoord.x * 1879 + cellCoord.y * 2971 + u_frame * 733)) * 43758.5453);
		bool shouldForceSwap = !proposerAtHome && forceSwap > 0.0 && forceRoll < forceSwap;
		if (shouldForceSwap && fallbackDir < SORT_DIR_NONE) {
			bestDir = fallbackDir;
			bestPriority = fallbackPriority;
		}
	}

	if (bestDir == SORT_DIR_NONE) {
		outColor = ivec4(0, SORT_DIR_NONE, 0, 1);
		return;
	}

	outColor = ivec4(int(round(bestPriority * PRIORITY_SCALE)), bestDir, 0, 1);
}
