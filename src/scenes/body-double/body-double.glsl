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
	vec3 texSize = vec3(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize.xy);
	float historyBufferSize = texSize.z;
	int maxDelayPerEcho = int(historyBufferSize / float(u_nEchoes));
	int delayPerEcho = int(1.0 + y1 * float(maxDelayPerEcho - 1));

	outColor = texture(u_inputStream, vec3(uv, historyZ(u_inputStream, u_inputStreamFrameOffset, 0)));
	for (int i = u_nEchoes; i >= 0; --i) {
		int delay = i * delayPerEcho;
		float z = historyZ(u_inputStream, u_inputStreamFrameOffset, delay);
		outColor = mix(outColor, texture(u_inputStream, vec3(uv, z)), inPose(uv, delay));
	}
}
