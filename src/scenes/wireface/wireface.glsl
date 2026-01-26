#version 300 es
precision highp float;

const float ONE_SIXTH = 1.0 / 6.0;
const float TWO_SIXTHS = 2.0 / 6.0;
const float THREE_SIXTHS = 3.0 / 6.0;
const float FOUR_SIXTHS = 4.0 / 6.0;
const float FIVE_SIXTHS = 5.0 / 6.0;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform sampler2D u_faceMesh;
uniform float u_backgroundColor;
uniform float u_lineHueRotation;
uniform float u_dotHueRotation;

vec3 hueToRgb(float h) {
	float c = 1.0;
	float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
	vec3 rgb;
	if (h < ONE_SIXTH) {
		rgb = vec3(c, x, 0.0);
	} else if (h < TWO_SIXTHS) {
		rgb = vec3(x, c, 0.0);
	} else if (h < THREE_SIXTHS) {
		rgb = vec3(0.0, c, x);
	} else if (h < FOUR_SIXTHS) {
		rgb = vec3(0.0, x, c);
	} else if (h < FIVE_SIXTHS) {
		rgb = vec3(x, 0.0, c);
	} else {
		rgb = vec3(c, 0.0, x);
	}
	return rgb;
}

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	float bg = step(0.5, u_backgroundColor);
	float cameraMix = 1.0 - abs(u_backgroundColor * 2.0 - 1.0); // Black at 0, full webcam passthrough at 0.5, white at 1.
	vec3 color = mix(vec3(bg), texture(u_inputStream, uv).rgb, cameraMix);

	float lineMask = texture(u_faceMesh, uv).r;
	float dotMask = texture(u_faceMesh, uv).g;

	color = mix(color, hueToRgb(u_lineHueRotation), lineMask);
	color = mix(color, hueToRgb(u_dotHueRotation), dotMask);

	outColor = vec4(color, 1.0);
}
