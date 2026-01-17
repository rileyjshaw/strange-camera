#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
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
	vec3 color = texture(u_inputStream, uv).rgb;

	vec2 segment = segmentAt(uv);
	if (segment.x > 0.0) {
		vec3 hairColor = hsv2rgb(vec3(u_hue, 1.0 - abs(u_brightness - 0.5) * 2.0, u_brightness));
		color = mix(color, hairColor * ((u_brightness - 0.5) * 2.0 + 1.0), segment.y * ((1.0 - u_brightness) * 0.3 + 0.1));
	}

	outColor = vec4(color, 1.0);
}
