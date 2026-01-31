#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_input;
uniform float u_radius;

void main() {
	vec2 u_texelSize = 1.0 / u_resolution;
	float step = max(1.0, u_radius) * u_texelSize.x;
	vec4 sum =
		texture(u_input, v_uv + vec2(-6.0 * step, 0.0)) * 0.002 +
		texture(u_input, v_uv + vec2(-5.0 * step, 0.0)) * 0.01 +
		texture(u_input, v_uv + vec2(-4.0 * step, 0.0)) * 0.028 +
		texture(u_input, v_uv + vec2(-3.0 * step, 0.0)) * 0.064 +
		texture(u_input, v_uv + vec2(-2.0 * step, 0.0)) * 0.122 +
		texture(u_input, v_uv + vec2(-1.0 * step, 0.0)) * 0.175 +
		texture(u_input, v_uv) * 0.199 +
		texture(u_input, v_uv + vec2(1.0 * step, 0.0)) * 0.175 +
		texture(u_input, v_uv + vec2(2.0 * step, 0.0)) * 0.122 +
		texture(u_input, v_uv + vec2(3.0 * step, 0.0)) * 0.064 +
		texture(u_input, v_uv + vec2(4.0 * step, 0.0)) * 0.028 +
		texture(u_input, v_uv + vec2(5.0 * step, 0.0)) * 0.01 +
		texture(u_input, v_uv + vec2(6.0 * step, 0.0)) * 0.002;
	outColor = sum;
}
