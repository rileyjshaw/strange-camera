#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_inputStream;
uniform float u_intensityCoupling;
uniform float u_sigma;

float luminance(vec3 color) {
	return dot(clamp(color, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
}

void main() {
	vec2 inputSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, inputSize);

	vec4 inputColor = texture(u_inputStream, uv);
	float lum = luminance(inputColor.rgb);

	float coupling = clamp(u_intensityCoupling, 0.0, 1.0);
	float threshold = mix(0.92, 0.22, coupling);
	float shoulder = mix(0.08, 0.34, coupling);
	float highlightGate = smoothstep(threshold - shoulder, threshold + shoulder, lum);
	float nonlinearEnergy = pow(lum, mix(4.5, 1.35, coupling));

	float microNoise = fract(sin(dot(gl_FragCoord.xy, vec2(127.1, 311.7))) * 43758.5453123);
	float textureGate = smoothstep(2.2, 8.0, u_sigma);
	float meshVariation = 1.0 + (microNoise - 0.5) * 0.055 * coupling * highlightGate * textureGate;

	vec3 excitation = inputColor.rgb * highlightGate * nonlinearEnergy * mix(0.85, 1.6, coupling);
	outColor = vec4(clamp(excitation * meshVariation, 0.0, 1.0), highlightGate);
}
