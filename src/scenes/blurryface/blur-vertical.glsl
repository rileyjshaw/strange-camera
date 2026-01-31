#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_input;
uniform float u_radius;

void main() {
	vec2 u_texelSize = 1.0 / u_resolution;
	float step = max(1.0, u_radius) * u_texelSize.y;
	vec4 sum =
		texture(u_input, v_uv + vec2(0.0, -6.0 * step)) * 0.002 +
		texture(u_input, v_uv + vec2(0.0, -5.0 * step)) * 0.01 +
		texture(u_input, v_uv + vec2(0.0, -4.0 * step)) * 0.028 +
		texture(u_input, v_uv + vec2(0.0, -3.0 * step)) * 0.064 +
		texture(u_input, v_uv + vec2(0.0, -2.0 * step)) * 0.122 +
		texture(u_input, v_uv + vec2(0.0, -1.0 * step)) * 0.175 +
		texture(u_input, v_uv) * 0.199 +
		texture(u_input, v_uv + vec2(0.0, 1.0 * step)) * 0.175 +
		texture(u_input, v_uv + vec2(0.0, 2.0 * step)) * 0.122 +
		texture(u_input, v_uv + vec2(0.0, 3.0 * step)) * 0.064 +
		texture(u_input, v_uv + vec2(0.0, 4.0 * step)) * 0.028 +
		texture(u_input, v_uv + vec2(0.0, 5.0 * step)) * 0.01 +
		texture(u_input, v_uv + vec2(0.0, 6.0 * step)) * 0.002;
	outColor = sum;
}
