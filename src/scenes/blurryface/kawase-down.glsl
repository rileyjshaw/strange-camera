#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_input;
uniform float u_offset;

void main() {
	vec2 texelSize = 1.0 / vec2(textureSize(u_input, 0));
	vec2 hp = texelSize * u_offset;

	vec4 sum = texture(u_input, v_uv) * 4.0;
	sum += texture(u_input, v_uv + vec2(-hp.x, -hp.y));
	sum += texture(u_input, v_uv + vec2( hp.x, -hp.y));
	sum += texture(u_input, v_uv + vec2(-hp.x,  hp.y));
	sum += texture(u_input, v_uv + vec2( hp.x,  hp.y));

	outColor = sum / 8.0;
}
