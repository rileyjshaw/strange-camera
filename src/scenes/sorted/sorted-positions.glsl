#version 300 es
// Credit: Inspired by https://www.reddit.com/r/generative/comments/1kddpwf/genuary_2025_day_31_pixel_sorting/

precision highp float;
precision highp int;

in vec2 v_uv;
out uvec4 outColor;

uniform sampler2D u_inputStream;
uniform highp usampler2DArray u_history;
uniform int u_historyFrameOffset;
uniform int u_frame;
uniform float u_sortAngle;
uniform float u_threshold;
uniform int u_pixelSize;
uniform int u_lookDist;

const ivec2 DIRS[4] = ivec2[4](ivec2(-1, 0), ivec2(0, 1), ivec2(1, 0), ivec2(0, -1));

ivec2 getCell(ivec2 screenCoord) {
	return screenCoord / u_pixelSize;
}

ivec2 cellToScreen(ivec2 cell) {
	return cell * u_pixelSize;
}

vec3 rgb2hsv(vec3 c) {
	const vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	const float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

uint encodePos(ivec2 pos, ivec2 size) {
	return uint(pos.y * size.x + pos.x);
}

ivec2 decodePos(uint idx, ivec2 size) {
	int n = int(idx);
	return ivec2(n % size.x, n / size.x);
}

ivec2 getCanvasSize() {
	return ivec2(u_resolution);
}

ivec2 getMappedPos(ivec2 screenCoord) {
	ivec2 size = getCanvasSize();
	if (screenCoord.x < 0 || screenCoord.y < 0 || 
	    screenCoord.x >= size.x || screenCoord.y >= size.y) {
		return ivec2(-1);
	}
	float z = historyZ(u_history, u_historyFrameOffset, 1);
	uint idx = texture(u_history, vec3((vec2(screenCoord) + 0.5) / vec2(size), z)).r;
	uint maxIdx = uint(size.x * size.y);
	if (idx >= maxIdx) return ivec2(-1);
	return decodePos(idx, size);
}

vec4 sampleWebcam(vec2 canvasUv) {
	vec2 inputSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(canvasUv, inputSize);
	return texture(u_inputStream, uv);
}

vec4 getColor(ivec2 screenCoord) {
	ivec2 canvasSize = getCanvasSize();
	ivec2 mappedPos = getMappedPos(screenCoord);
	if (mappedPos.x < 0) mappedPos = screenCoord;
	vec2 canvasUv = (vec2(mappedPos) + 0.5) / vec2(canvasSize);
	return sampleWebcam(canvasUv);
}

float criterion(vec4 color) {
	vec3 hsv = rgb2hsv(color.rgb);
	hsv.x = floor(hsv.x * 15.0) / 15.0;
	return hsv.z > 0.5 ? hsv.x + hsv.z : -hsv.x + hsv.z;
}

const int DIR_ORDER[4] = int[4](3, 1, 2, 0);

bool canSwap(ivec2 cellCoord, int d, float myCrit, ivec2 canvasSize) {
	ivec2 neighborCell = cellCoord + DIRS[d] * u_lookDist;
	ivec2 neighborScreen = cellToScreen(neighborCell);
	if (neighborScreen.x < 0 || neighborScreen.y < 0 ||
	    neighborScreen.x >= canvasSize.x || neighborScreen.y >= canvasSize.y) {
		return false;
	}
	
	vec4 neighborColor = getColor(neighborScreen);
	float neighborCrit = criterion(neighborColor);
	vec2 sortDir = vec2(cos(u_sortAngle), sin(u_sortAngle));
	vec2 dirVec = vec2(DIRS[d]);
	bool isForward = dot(dirVec, sortDir) > 0.0;
	return myCrit != neighborCrit &&
	       abs(myCrit - neighborCrit) < u_threshold &&
	       (myCrit < neighborCrit) == isForward;
}

int computeDirection(ivec2 cellCoord) {
	ivec2 canvasSize = getCanvasSize();
	ivec2 screenCoord = cellToScreen(cellCoord);
	vec4 myColor = getColor(screenCoord);
	float myCrit = criterion(myColor);
	int startIdx = (cellCoord.x + cellCoord.y + u_frame) % 4;
	for (int i = 0; i < 4; i++) {
		int d = DIR_ORDER[(startIdx + i) % 4];
		if (canSwap(cellCoord, d, myCrit, canvasSize)) {
			return d;
		}
	}
	
	return -1;
}

void main() {
	ivec2 screenCoord = ivec2(gl_FragCoord.xy);
	ivec2 canvasSize = getCanvasSize();
	ivec2 cellCoord = getCell(screenCoord);
	ivec2 cellScreenCoord = cellToScreen(cellCoord);

	if (u_frame <= 1) {
		outColor = uvec4(encodePos(screenCoord, canvasSize), 0u, 0u, 1u);
		return;
	}

	ivec2 prevPos = getMappedPos(cellScreenCoord);
	if (prevPos.x < 0 || prevPos.x >= canvasSize.x || 
	    prevPos.y < 0 || prevPos.y >= canvasSize.y) {
		outColor = uvec4(encodePos(screenCoord, canvasSize), 0u, 0u, 1u);
		return;
	}

	ivec2 offsetInCell = screenCoord - cellScreenCoord;
	int myDir = computeDirection(cellCoord);

	if (myDir >= 0) {
		ivec2 neighborCell = cellCoord + DIRS[myDir] * u_lookDist;
		int neighborDir = computeDirection(neighborCell);
		if (neighborDir >= 0 && abs(myDir - neighborDir) == 2) {
			ivec2 neighborScreen = cellToScreen(neighborCell);
			ivec2 neighborPos = getMappedPos(neighborScreen);
			if (neighborPos.x >= 0) {
				ivec2 newPos = clamp(neighborPos + offsetInCell, ivec2(0), canvasSize - 1);
				outColor = uvec4(encodePos(newPos, canvasSize), 0u, 0u, 1u);
				return;
			}
		}
	}

	ivec2 newPos = clamp(prevPos + offsetInCell, ivec2(0), canvasSize - 1);
	outColor = uvec4(encodePos(newPos, canvasSize), 0u, 0u, 1u);
}
