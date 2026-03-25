#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_inputStream;
uniform sampler2D u_mask;
uniform sampler2D u_palette;
uniform sampler2D u_knollPlan;
uniform float u_cellSizePx;
uniform int u_maskSize;

const int LUT_AXIS = 12;
const int MAX_PALETTE_SIZE = 16;

vec3 fetchPaletteColor(float index) {
	return texelFetch(u_palette, ivec2(int(index + 0.5), 0), 0).rgb;
}

float decodeMaskThreshold(vec2 maskUv, float maskSize) {
	vec4 packedMask = texture(u_mask, maskUv);
	float rank =
		floor(packedMask.r * 255.0 + 0.5) +
		256.0 * floor(packedMask.g * 255.0 + 0.5) +
		65536.0 * floor(packedMask.b * 255.0 + 0.5);
	return (rank + 0.5) / (maskSize * maskSize);
}

float fetchKnollCumulative(vec3 color, int paletteIndex, int paletteSize) {
	vec3 snapped = floor(color * float(LUT_AXIS - 1) + 0.5);
	ivec3 coord = ivec3(clamp(snapped, 0.0, float(LUT_AXIS - 1)));
	int lutColumn = coord.x + coord.y * LUT_AXIS;
	return texelFetch(u_knollPlan, ivec2(lutColumn * paletteSize + paletteIndex, coord.z), 0).r;
}

void main() {
	float maskSize = float(u_maskSize);
	vec2 pixelCoord = gl_FragCoord.xy - vec2(0.5);
	vec2 cellCoord = floor(pixelCoord / u_cellSizePx);
	vec2 cellCenterPx = (cellCoord + 0.5) * u_cellSizePx;
	vec2 screenUv = clamp((cellCenterPx + 0.5) / u_resolution, 0.0, 1.0);

	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 sourceUv = fitCover(screenUv, texSize);
	vec3 sourceColor = texture(u_inputStream, sourceUv).rgb;

	vec2 maskUv = (cellCoord + 0.5) / maskSize;
	float threshold = decodeMaskThreshold(maskUv, maskSize);
	int paletteSize = min(textureSize(u_palette, 0).x, MAX_PALETTE_SIZE);

	float index = 0.0;
	for (int paletteIndex = 0; paletteIndex < MAX_PALETTE_SIZE - 1; paletteIndex++) {
		if (paletteIndex >= paletteSize - 1) break;
		float cumulative = fetchKnollCumulative(sourceColor, paletteIndex, paletteSize);
		if (threshold >= cumulative) {
			index = float(paletteIndex + 1);
		}
	}

	outColor = vec4(fetchPaletteColor(index), 1.0);
}
