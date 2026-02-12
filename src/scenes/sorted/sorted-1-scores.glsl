#version 300 es
// Pass 1 — Score: edge swap scores (left/up) at cell anchors.

precision highp float;
precision highp int;

in vec2 v_uv;
out ivec4 outColor;

const float SCORE_SCALE = 32767.0;

uniform sampler2D u_inputStream;
uniform highp usampler2D u_positionMap;
uniform float u_heuristic;
uniform float u_sortAngle;
uniform float u_threshold;
uniform int u_pixelSize;
uniform int u_lookDist;
uniform int u_activeCellsX;
uniform int u_activeCellsY;

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

float swapScoreColorValue(ivec2 dir, float myColorValue, ivec2 neighborTexCoord, vec2 sortDir) {
	if (!inBounds(neighborTexCoord, ivec2(u_resolution)))
		return 0.0;
	float neighborColorValue = sampleColorValueAtScreen(neighborTexCoord);
	float diff = myColorValue - neighborColorValue;
	if (diff == 0.0 || abs(diff) > u_threshold) return 0.0;
	vec2 dirVec = vec2(dir);
	float isForward = sign(dot(dirVec, sortDir));
	return diff / u_threshold * isForward;
}

int shortestWrappedDelta(int fromCoord, int toCoord, int size) {
	if (size <= 0) return fromCoord - toCoord;
	int delta = fromCoord - toCoord;
	int halfSize = size / 2;
	if (delta > halfSize) delta -= size;
	if (delta < -halfSize) delta += size;
	return delta;
}

ivec2 wrappedDelta(ivec2 fromCoord, ivec2 toCoord, ivec2 size) {
	return ivec2(
		shortestWrappedDelta(fromCoord.x, toCoord.x, size.x),
		shortestWrappedDelta(fromCoord.y, toCoord.y, size.y)
	);
}

int wrappedAxisCount(ivec2 directDelta, ivec2 wrappedDeltaVec) {
	int count = 0;
	if (directDelta.x != wrappedDeltaVec.x) count += 1;
	if (directDelta.y != wrappedDeltaVec.y) count += 1;
	return count;
}

float swapScorePosition(ivec2 posCoordSelf, ivec2 posCoordNeighbor, ivec2 cellScreenCoord, ivec2 neighborScreenCoord, int dist) {
	ivec2 myMapped = getMappedPos(posCoordSelf);
	ivec2 neighborMapped = getMappedPos(posCoordNeighbor);
	if (myMapped.x < 0 || neighborMapped.x < 0) return 0.0;
	ivec2 canvasSize = ivec2(u_resolution);

	ivec2 directDeltaA = cellScreenCoord - myMapped;
	ivec2 directDeltaB = neighborScreenCoord - neighborMapped;
	ivec2 directDeltaC = cellScreenCoord - neighborMapped;
	ivec2 directDeltaD = neighborScreenCoord - myMapped;

	ivec2 deltaA = wrappedDelta(cellScreenCoord, myMapped, canvasSize);
	ivec2 deltaB = wrappedDelta(neighborScreenCoord, neighborMapped, canvasSize);
	ivec2 deltaC = wrappedDelta(cellScreenCoord, neighborMapped, canvasSize);
	ivec2 deltaD = wrappedDelta(neighborScreenCoord, myMapped, canvasSize);

	vec2 a = vec2(deltaA);
	vec2 b = vec2(deltaB);
	vec2 c = vec2(deltaC);
	vec2 d = vec2(deltaD);
	float sqDistBefore = dot(a, a) + dot(b, b);
	float sqDistAfter = dot(c, c) + dot(d, d);
	float improvement = sqDistBefore - sqDistAfter;
	int l1BeforeWrapped = abs(deltaA.x) + abs(deltaA.y) + abs(deltaB.x) + abs(deltaB.y);
	int l1AfterWrapped = abs(deltaC.x) + abs(deltaC.y) + abs(deltaD.x) + abs(deltaD.y);
	float l1ImprovementWrapped = float(l1BeforeWrapped - l1AfterWrapped);

	vec2 ad = vec2(directDeltaA);
	vec2 bd = vec2(directDeltaB);
	vec2 cd = vec2(directDeltaC);
	vec2 dd = vec2(directDeltaD);
	float sqDistBeforeDirect = dot(ad, ad) + dot(bd, bd);
	float sqDistAfterDirect = dot(cd, cd) + dot(dd, dd);
	float improvementDirect = sqDistBeforeDirect - sqDistAfterDirect;
	int l1BeforeDirect = abs(directDeltaA.x) + abs(directDeltaA.y) + abs(directDeltaB.x) + abs(directDeltaB.y);
	int l1AfterDirect = abs(directDeltaC.x) + abs(directDeltaC.y) + abs(directDeltaD.x) + abs(directDeltaD.y);
	float l1ImprovementDirect = float(l1BeforeDirect - l1AfterDirect);

	int wrappedAxesBefore = wrappedAxisCount(directDeltaA, deltaA) + wrappedAxisCount(directDeltaB, deltaB);
	int wrappedAxesAfter = wrappedAxisCount(directDeltaC, deltaC) + wrappedAxisCount(directDeltaD, deltaD);
	float wrapUsageImprovement = float(wrappedAxesBefore - wrappedAxesAfter);

	if (improvement == 0.0 && l1ImprovementWrapped != 0.0) {
		improvement = l1ImprovementWrapped;
	}
	if (improvement == 0.0 && sqDistBefore > 0.0) {
		if (dot(c, c) == 0.0 || dot(d, d) == 0.0) improvement = 1.0;
	}
	float cellDist = 2.0 * float(dist * u_pixelSize);
	float wrappedRadialScore = clamp(sign(improvement) * sqrt(abs(improvement)) / cellDist, -1.0, 1.0);
	float wrappedHomeScore = clamp(l1ImprovementWrapped / cellDist, -1.0, 1.0);
	float directRadialScore = clamp(sign(improvementDirect) * sqrt(abs(improvementDirect)) / cellDist, -1.0, 1.0);
	float directHomeScore = clamp(l1ImprovementDirect / cellDist, -1.0, 1.0);
	float wrappedScore = mix(wrappedRadialScore, wrappedHomeScore, 0.35);
	float directScore = mix(directRadialScore, directHomeScore, 0.35);
	float wrapPreferenceScore = clamp(wrapUsageImprovement * 0.25, -1.0, 1.0);
	return clamp(mix(wrappedScore, directScore, 0.7) + wrapPreferenceScore * 0.15, -1.0, 1.0);
}

float computeSwapScore(ivec2 cellCoord, ivec2 dirOffset, int dist) {
	ivec2 activeCells = ivec2(u_activeCellsX, u_activeCellsY);
	ivec2 cellScreenCoord = cellToScreenSample(cellCoord, u_pixelSize);
	ivec2 neighborCell = wrapCellCoord(cellCoord + dirOffset, activeCells);
	ivec2 neighborScreenCoord = cellToScreenSample(neighborCell, u_pixelSize);

	float myColorValue = sampleColorValueAtScreen(cellScreenCoord);
	vec2 sortDir = vec2(cos(u_sortAngle), sin(u_sortAngle));

	float colorScore = swapScoreColorValue(dirOffset, myColorValue, neighborScreenCoord, sortDir);
	float positionScore = swapScorePosition(cellScreenCoord, neighborScreenCoord, cellScreenCoord, neighborScreenCoord, dist);
	return mix(colorScore, positionScore, u_heuristic);
}

void main() {
	ivec2 activeCells = ivec2(u_activeCellsX, u_activeCellsY);
	ivec2 screenCoord = ivec2(gl_FragCoord.xy);
	ivec2 cellCoord = getCellFromScreen(screenCoord, u_pixelSize);
	ivec2 cellAnchor = cellToScreenAnchor(cellCoord, u_pixelSize);
	if (!isCellInBounds(cellCoord, activeCells) || screenCoord != cellAnchor) {
		outColor = ivec4(0);
		return;
	}

	int distX = wrapLookDistAxis(u_lookDist, activeCells.x);
	int distY = wrapLookDistAxis(u_lookDist, activeCells.y);
	float leftScore = distX > 0 ? computeSwapScore(cellCoord, ivec2(-distX, 0), distX) : 0.0;
	float upScore = distY > 0 ? computeSwapScore(cellCoord, ivec2(0, -distY), distY) : 0.0;

	outColor = ivec4(
		int(round(leftScore * SCORE_SCALE)),
		int(round(upScore * SCORE_SCALE)),
		0, 1
	);
}
