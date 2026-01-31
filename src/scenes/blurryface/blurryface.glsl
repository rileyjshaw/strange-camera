#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform sampler2D u_blurred;
uniform float u_mode;

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	vec3 camColor = texture(u_inputStream, uv).rgb;
	vec3 blurredColor = texture(u_blurred, uv).rgb;

	vec2 currentSegment = segmentAt(uv, 0);
	vec2 previousSegment = segmentAt(uv, 1);
	float maskCurr = currentSegment.x * (1.0 - currentSegment.y);
	float maskPrev = previousSegment.x * (1.0 - previousSegment.y);
	float maskSmoothed = mix(maskPrev, maskCurr, 0.35);
	float mask = smoothstep(0.15, 0.5, maskSmoothed);

	float mixFactor = clamp(abs(1.0 - mask - u_mode) * 2.0, 0.0, 1.0);
	outColor = vec4(mix(camColor, blurredColor, mixFactor), 1.0);
}
