#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform highp sampler2DArray u_inputStream;
uniform int u_inputStreamFrameOffset;
uniform int u_frame;
uniform int u_nEchoes;
uniform float y1;

void main() {
	ivec3 texSize = textureSize(u_inputStream, 0);
	vec2 uv = fitCover(v_uv, vec2(texSize.xy));
	int historyBufferSize = texSize.z - 1;
	int maxDelayPerEcho = historyBufferSize / u_nEchoes;
	int delayPerEcho = int(y1 * float(maxDelayPerEcho));

	outColor = texture(u_inputStream, vec3(uv, historyZ(u_inputStream, u_inputStreamFrameOffset, 0)));
	for (int i = u_nEchoes; i >= 0; --i) {
		int delay = i * delayPerEcho;
		float z = historyZ(u_inputStream, u_inputStreamFrameOffset, delay);
		vec2 segment = segmentAt(uv, delay);
		outColor = mix(outColor, texture(u_inputStream, vec3(uv, z)), (1.0 - segment.x) * segment.y);
	}
}
