#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform highp sampler2DArray u_inputStream;
uniform int u_inputStreamFrameOffset;
uniform int u_frame;
uniform int u_nEchoes;
uniform int u_frameDelayPerEcho;
uniform float u_dimmingFactor;

void main() {
	vec2 uv = fitCover(v_uv, vec2(textureSize(u_inputStream, 0)));

	vec3 color = vec3(0.0);
	for (int i = 0; i < u_nEchoes; ++i) {
		int frameOffsetR = int(float(i) * float(u_frameDelayPerEcho));
		int frameOffsetG = int((float(i) + .33) * float(u_frameDelayPerEcho));
		int frameOffsetB = int((float(i) + .66) * float(u_frameDelayPerEcho));
		vec3 echo = vec3(0.0);
		echo.r += texture(u_inputStream, vec3(uv, historyZ(u_inputStream, u_inputStreamFrameOffset, frameOffsetR))).r;
		echo.g += texture(u_inputStream, vec3(uv, historyZ(u_inputStream, u_inputStreamFrameOffset, frameOffsetG))).g;
		echo.b += texture(u_inputStream, vec3(uv, historyZ(u_inputStream, u_inputStreamFrameOffset, frameOffsetB))).b;
		color += echo * u_dimmingFactor * float(u_nEchoes - i);
	}

	outColor = vec4(color, 1.0);
}
