#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform sampler2D u_blurred;
uniform float u_mode;

float getMask(vec2 uv, int frame) {
	vec2 seg = segmentAt(uv, frame);
	return seg.x * (1.0 - seg.y);
}

float blurMask(vec2 uv, int frame) {
	vec2 o = 10.0 / u_resolution;
	return (
		getMask(uv, frame) * 4.0
		+ getMask(uv + vec2( o.x, 0.0), frame) * 2.0
		+ getMask(uv + vec2(-o.x, 0.0), frame) * 2.0
		+ getMask(uv + vec2(0.0,  o.y), frame) * 2.0
		+ getMask(uv + vec2(0.0, -o.y), frame) * 2.0
		+ getMask(uv + vec2( o.x,  o.y), frame)
		+ getMask(uv + vec2(-o.x,  o.y), frame)
		+ getMask(uv + vec2( o.x, -o.y), frame)
		+ getMask(uv + vec2(-o.x, -o.y), frame)
	) / 16.0;
}

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	vec3 camColor = texture(u_inputStream, uv).rgb;
	vec3 blurredColor = texture(u_blurred, uv).rgb;

	float maskCurr = blurMask(uv, 0);
	float maskPrev = blurMask(uv, 1);
	float maskSmoothed = mix(maskPrev, maskCurr, 0.35);
	float mask = smoothstep(0.15, 0.5, maskSmoothed);

	float mixFactor = clamp(abs(1.0 - mask - u_mode) * 2.0, 0.0, 1.0);
	outColor = vec4(mix(camColor, blurredColor, mixFactor), 1.0);
}
