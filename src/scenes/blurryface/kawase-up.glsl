#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_input;
uniform float u_offset;

void main() {
	vec2 texelSize = 1.0 / vec2(textureSize(u_input, 0));
	vec2 hp = texelSize * u_offset;

	vec4 sum = vec4(0.0);
	sum += texture(u_input, v_uv + vec2(-hp.x * 2.0, 0.0));
	sum += texture(u_input, v_uv + vec2(-hp.x, hp.y)) * 2.0;
	sum += texture(u_input, v_uv + vec2(0.0, hp.y * 2.0));
	sum += texture(u_input, v_uv + vec2(hp.x, hp.y)) * 2.0;
	sum += texture(u_input, v_uv + vec2(hp.x * 2.0, 0.0));
	sum += texture(u_input, v_uv + vec2(hp.x, -hp.y)) * 2.0;
	sum += texture(u_input, v_uv + vec2(0.0, -hp.y * 2.0));
	sum += texture(u_input, v_uv + vec2(-hp.x, -hp.y)) * 2.0;

	outColor = sum / 12.0;
}
