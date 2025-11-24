#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform highp sampler2DArray u_inputStream;
uniform int u_inputStreamFrameOffset;
uniform float x1;

void main() {
	float numColumns = 1.0 + 195.0; // TODO: Use vars. 1.0 + x1 * 195.0;
	float columnIndex = floor(v_uv.x * numColumns);
	int delay = int(columnIndex);
	vec2 texUv = fitCover(v_uv, vec2(textureSize(u_inputStream, 0).xy));
	float z = historyZ(u_inputStream, u_inputStreamFrameOffset, delay);
	outColor = texture(u_inputStream, vec3(1.0 - texUv.x, texUv.y, z));
}
