#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform highp sampler2DArray u_inputStream;
uniform int u_inputStreamFrameOffset;
uniform float x1;
uniform float y1;

void main() {
	float historyBufferSize = float(textureSize(u_inputStream, 0).z);
	float nStrips = 2.0 + x1 * (historyBufferSize - 2.0);
	int maxDelayPerStrip = int(historyBufferSize / nStrips);
	int delayPerStrip = int(1.0 + y1 * float(maxDelayPerStrip - 1));
	int stripIndex = int(v_uv.x * nStrips);
	int delay = stripIndex * delayPerStrip;
	vec2 texUv = fitCover(v_uv, vec2(textureSize(u_inputStream, 0).xy));
	float z = historyZ(u_inputStream, u_inputStreamFrameOffset, delay);
	outColor = texture(u_inputStream, vec3(1.0 - texUv.x, texUv.y, z));
}
