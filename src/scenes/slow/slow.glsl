#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform highp sampler2DArray u_inputStream;
uniform int u_inputStreamFrameOffset;
uniform int u_divisions;
uniform int u_framesPerDivision;

float luminance(vec3 color) {
	return dot(clamp(color, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
}

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0).xy);
	vec2 uv = fitCover(v_uv, texSize);
	vec4 current = texture(u_inputStream, vec3(uv, historyZ(u_inputStream, u_inputStreamFrameOffset, 0)));
	float rawLightness = luminance(current.rgb);
	// For positive divisions, dark pixels are delayed more. For negative divisions, dark pixels are delayed less.
	int division = int(floor(abs((step(0.0, float(u_divisions)) - rawLightness) * float(u_divisions))));
	int delay = division * u_framesPerDivision;
	float z = historyZ(u_inputStream, u_inputStreamFrameOffset, delay);
	outColor = texture(u_inputStream, vec3(uv, z));
}
