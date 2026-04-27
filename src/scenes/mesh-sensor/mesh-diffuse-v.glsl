#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_input;
uniform highp sampler2DArray u_history;
uniform int u_historyFrameOffset;
uniform float u_sigma;
uniform float u_anisotropy;
uniform float u_spectralSpread;
uniform float u_persistence;

const int MAX_RADIUS = 32;

float gaussian(float d, float sigma) {
	if (sigma <= 0.0) return 0.0;
	return exp(-(d * d) / (2.0 * sigma * sigma));
}

void main() {
	vec2 texSize = vec2(textureSize(u_input, 0));
	vec2 texel = 1.0 / texSize;

	float axisBias = u_anisotropy * 2.0 - 1.0;
	float biasedAxis = sign(axisBias) * pow(abs(axisBias), 0.72);
	float sigmaScaleV = mix(1.0, 0.07, max(-biasedAxis, 0.0)) * mix(1.0, 6.0, max(biasedAxis, 0.0));
	float sigmaV = max(0.25, u_sigma * sigmaScaleV);

	float sigmaR = sigmaV * (1.0 + 1.55 * u_spectralSpread);
	float sigmaG = sigmaV * (1.0 + 0.2 * u_spectralSpread);
	float sigmaB = sigmaV * max(0.35, 1.0 - 0.65 * u_spectralSpread);

	vec4 sum = vec4(0.0);
	float sumWr = 0.0, sumWg = 0.0, sumWb = 0.0;

	for (int i = -MAX_RADIUS; i <= MAX_RADIUS; ++i) {
		float d = float(i);
		float wr = gaussian(d, sigmaR);
		float wg = gaussian(d, sigmaG);
		float wb = gaussian(d, sigmaB);

		vec2 offset = vec2(0.0, d * texel.y);
		vec4 s = texture(u_input, v_uv + offset);

		sum.r += s.r * wr;
		sum.g += s.g * wg;
		sum.b += s.b * wb;
		sum.a += s.a * wg;

		sumWr += wr;
		sumWg += wg;
		sumWb += wb;
	}

	sum.r /= max(sumWr, 1e-6);
	sum.g /= max(sumWg, 1e-6);
	sum.b /= max(sumWb, 1e-6);
	sum.a /= max(sumWg, 1e-6);

	float z = historyZ(u_history, u_historyFrameOffset, 1);
	vec4 prev = texture(u_history, vec3(v_uv, z));
	vec4 blended = max(prev * u_persistence, sum);

	outColor = clamp(blended, 0.0, 1.0);
}
