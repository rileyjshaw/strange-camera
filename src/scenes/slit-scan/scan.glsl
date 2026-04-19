#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_inputStream;
uniform highp sampler2DArray u_history;
uniform int u_historyFrameOffset;

uniform float u_angle;
uniform float u_posFrom;
uniform float u_posTo;

void main() {
	vec2 dir = vec2(cos(u_angle), sin(u_angle));
	float maxLen = max(abs(dir.x) + abs(dir.y), 1e-4);
	float s = 0.5 + dot(v_uv - 0.5, dir) / maxLen;

	bool inBand;
	if (u_posFrom <= u_posTo) {
		inBand = s >= u_posFrom && s <= u_posTo;
	} else {
		inBand = s >= u_posFrom || s <= u_posTo;
	}

	if (inBand) {
		vec2 texSize = vec2(textureSize(u_inputStream, 0));
		vec2 uv = fitCover(v_uv, texSize);
		outColor = texture(u_inputStream, uv);
	} else {
		float z = historyZ(u_history, u_historyFrameOffset, 1);
		outColor = texture(u_history, vec3(v_uv, z));
	}
}
