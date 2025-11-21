#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform highp sampler2DArray u_inputStream;
uniform int u_inputStreamFrameOffset;
uniform float x1;

void main() {
	float numColumns = 1.0 + 195.0; // TODO: Use vars. 1.0 + x1 * 195.0;

	// Calculate which column this pixel is in (0 to numColumns-1)
	float columnIndex = floor(v_uv.x * numColumns);

	// Calculate delay for this column (floored to 0, starting from left)
	int delay = int(columnIndex);

	// Get the history frame based on delay and frame offset
	float z = historyZ(u_inputStream, u_inputStreamFrameOffset, delay);

	outColor = texture(u_inputStream, vec3(1.0 - v_uv.x, v_uv.y, z));
}
