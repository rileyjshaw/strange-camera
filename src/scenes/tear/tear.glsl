#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_inputStream;
uniform highp sampler2DArray u_history;
uniform int u_historyFrameOffset;
uniform int u_frame;

uniform float u_initialAngle;
uniform float u_angleIncrement;
uniform float u_jitter;
uniform float u_roughness;
uniform float u_width;
uniform float u_speed;

const float MIN_TEAR_INTERVAL_FRAMES = 60.0;
const float MAX_JITTER = 0.7853981633974483;

float hash11(float p) {
	p = fract(p * 0.1031);
	p *= p + 33.33;
	p *= p + p;
	return fract(p);
}

float valueNoise(float x, float seed) {
	float i = floor(x);
	float f = fract(x);
	float a = hash11(i + seed * 37.17);
	float b = hash11(i + 1.0 + seed * 37.17);
	return mix(a, b, f);
}

float tornNoise(float x, float seed, float roughness) {
	float freq = mix(8.0, 48.0, roughness);
	float n = valueNoise(x * freq, seed);
	n += valueNoise(x * freq * 2.31 + 19.7, seed + 5.0) * 0.5;
	n += valueNoise(x * freq * 5.17 - 8.2, seed + 11.0) * 0.22;
	return n / 1.72 * 2.0 - 1.0;
}

vec2 uvToSpace(vec2 uv, float aspect) {
	return vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
}

vec2 spaceToUv(vec2 p, float aspect) {
	return vec2(p.x / aspect + 0.5, p.y + 0.5);
}

float insideUv(vec2 uv) {
	vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
	return inside.x * inside.y;
}

float between(float value, float a, float b) {
	return step(min(a, b), value) * step(value, max(a, b));
}

float roughEdgeMask(float across, float tearLine, float roughLine, float side, float halfGap) {
	float shiftedTearLine = tearLine + side * halfGap;
	float shiftedRoughLine = roughLine + side * halfGap;
	float roughLineInGap = step(0.0, -side * (shiftedRoughLine - shiftedTearLine));
	float pixelInGap = step(0.0, -side * (across - shiftedTearLine));
	return roughLineInGap * pixelInGap * between(across, shiftedTearLine, shiftedRoughLine);
}

void main() {
	vec2 cameraUv = fitCover(v_uv, vec2(textureSize(u_inputStream, 0)));
	vec4 camera = texture(u_inputStream, cameraUv);
	vec3 color = camera.rgb;
	float z = historyZ(u_history, u_historyFrameOffset, 1);
	vec4 historyFrame = texture(u_history, vec3(v_uv, z));

	float frame = float(u_frame);
	float speed = clamp(u_speed, 0.0, 1.0);
	float tearInterval = mix(MIN_TEAR_INTERVAL_FRAMES, 1.0, speed);
	float tearIndex = floor(frame / tearInterval);
	float prevTearIndex = floor(max(frame - 1.0, 0.0) / tearInterval);
	bool isTearFrame = u_frame == 0 || tearIndex > prevTearIndex;

	if (!isTearFrame) {
		color = mix(color, historyFrame.rgb, historyFrame.a);
		outColor = vec4(color, 1.0);
		return;
	}

	float aspect = u_resolution.x / u_resolution.y;
	vec2 p = uvToSpace(v_uv, aspect);

	float jitterControl = clamp(u_jitter / MAX_JITTER, 0.0, 1.0);
	float angleJitter = hash11(tearIndex + 1.0) * u_jitter;
	float angle = u_initialAngle + tearIndex * u_angleIncrement + angleJitter;
	vec2 dir = vec2(cos(angle), sin(angle));
	vec2 normal = vec2(-dir.y, dir.x);

	float screenReach = dot(abs(normal), vec2(aspect, 1.0)) * 0.5;
	float centerOffset = (hash11(tearIndex + 17.0) * 2.0 - 1.0) * screenReach * jitterControl * 0.25;
	float along = dot(p, dir);
	float across = dot(p, normal);

	float roughness = clamp(u_roughness, 0.0, 1.0);
	float roughAmp = mix(0.001, 0.075, roughness * roughness);
	float tearLine = centerOffset + tornNoise(along, tearIndex + 23.0, roughness) * roughAmp;
	float edgeLine = centerOffset + tornNoise(along + 41.0, tearIndex + 79.0, roughness) * roughAmp * 1.25;
	float tearDistance = across - tearLine;

	float halfGap = 0.5 * u_width / u_resolution.y;
	float side = sign(tearDistance);
	float outsideGap = step(halfGap, abs(tearDistance));
	vec2 sourceUv = spaceToUv(p - normal * side * halfGap, aspect);
	float validSource = outsideGap * insideUv(sourceUv);

	float whiteMask = max(
		roughEdgeMask(across, tearLine, edgeLine, -1.0, halfGap),
		roughEdgeMask(across, tearLine, edgeLine, 1.0, halfGap)
	);
	whiteMask *= step(0.01, roughness);
	color = mix(color, vec3(1.0), whiteMask);

	vec4 transformedHistory = texture(u_history, vec3(clamp(sourceUv, vec2(0.0), vec2(1.0)), z));
	color = mix(color, transformedHistory.rgb, validSource * transformedHistory.a);

	outColor = vec4(color, 1.0);
}
