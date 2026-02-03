#version 300 es
// Credit: Inspired by https://www.reddit.com/r/generative/comments/1kddpwf/genuary_2025_day_31_pixel_sorting/

precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_inputStream;
uniform highp usampler2D u_positionMap;

void main() {
	ivec2 screenCoord = ivec2(gl_FragCoord.xy);
	ivec2 canvasSize = ivec2(textureSize(u_positionMap, 0));
	vec2 inputSize = vec2(textureSize(u_inputStream, 0));
	screenCoord = clamp(screenCoord, ivec2(0), canvasSize - 1);
	uint idx = texelFetch(u_positionMap, screenCoord, 0).r;
	uint maxIdx = uint(canvasSize.x * canvasSize.y);
	idx = min(idx, maxIdx - 1u);
	int n = int(idx);
	ivec2 mappedPos = ivec2(n % canvasSize.x, n / canvasSize.x);
	vec2 canvasUv = (vec2(mappedPos) + 0.5) / vec2(canvasSize);
	vec2 uv = fitCover(canvasUv, inputSize);
	outColor = texture(u_inputStream, uv);
}
