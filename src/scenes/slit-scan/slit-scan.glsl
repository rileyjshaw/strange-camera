#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_scan;
uniform float u_angle;
uniform float u_pos;

void main() {
	vec4 color = texture(u_scan, v_uv);

	vec2 dir = vec2(cos(u_angle), sin(u_angle));
	float maxLen = max(abs(dir.x) + abs(dir.y), 1e-4);
	float s = 0.5 + dot(v_uv - 0.5, dir) / maxLen;

	float d = abs(s - u_pos);
	d = min(d, 1.0 - d);

	float aa = fwidth(s);
	float bar = 1.0 - smoothstep(aa, aa * 2.5, d);
	color.rgb = mix(color.rgb, vec3(0.0), bar);

	outColor = color;
}
