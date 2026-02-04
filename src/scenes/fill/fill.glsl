#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform float u_opacity;
uniform float u_hue;
uniform float u_brightness;

vec3 hsv2rgb(vec3 c) {
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	vec3 camera = texture(u_inputStream, uv).rgb;

	vec2 seg = segmentAt(uv);
	float confidence = seg.x;
	float category = seg.y;

	float isForeground = (1.0 - step(category, 0.0)) * mix(confidence, 1.0, u_opacity * u_opacity);
	float n = float(max(u_numCategories - 1, 1));
	float shade = floor(category * n + 0.5) / n;
	float saturation = 0.35 + 0.6 * shade;
	vec3 fill = hsv2rgb(vec3(u_hue, saturation, u_brightness));
	float whiteMix = pow(smoothstep(0.6, 1.0, u_brightness), 2.0);
	fill = mix(fill, vec3(1.0), whiteMix);

	vec3 color = mix(camera, fill, isForeground * u_opacity);
	outColor = vec4(color, 1.0);
}
