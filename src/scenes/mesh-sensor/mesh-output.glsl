#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_inputStream;
uniform sampler2D u_fieldState;
uniform float u_halationStrength;
uniform float u_intensityCoupling;
uniform float u_spectralSpread;

float luminance(vec3 color) {
	return dot(clamp(color, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
}

void main() {
	vec2 inputSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, inputSize);

	vec4 inputColor = texture(u_inputStream, uv);
	vec4 field = texture(u_fieldState, v_uv);

	float lum = luminance(inputColor.rgb);
	float fieldLum = luminance(field.rgb);
	float coupling = clamp(u_intensityCoupling, 0.0, 1.0);

	float spillMask = smoothstep(0.015, 0.45, fieldLum - lum * mix(0.9, 0.42, coupling));
	float coreMask = smoothstep(0.58, 1.0, lum) * smoothstep(0.04, 0.7, fieldLum);

	vec3 spectralTint = mix(vec3(1.0), vec3(1.22, 0.82, 0.56), u_spectralSpread);
	vec3 glow = max(field.rgb - inputColor.rgb * mix(0.58, 0.28, coupling), 0.0);
	glow = mix(field.rgb * 0.38, glow, 0.72) * spectralTint;

	vec3 base = inputColor.rgb / (1.0 + coreMask * u_halationStrength * 0.28);
	vec3 additive = base + glow * u_halationStrength * (0.35 + 0.85 * spillMask);
	vec3 screened = 1.0 - (1.0 - base) * (1.0 - clamp(glow * u_halationStrength, 0.0, 1.0));
	vec3 composite = mix(additive, screened, 0.22 + 0.24 * coupling);

	outColor = vec4(clamp(composite, 0.0, 1.0), 1.0);
}
