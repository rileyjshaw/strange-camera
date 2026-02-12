#version 300 es
// Prepass: compute colorValue (webcam + HSV) once per pixel.
// Output R32F: one float per fragment. Score pass samples this instead of repeated getColor/rgb2hsv.

precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_inputStream;
uniform highp usampler2D u_positionMap;
uniform int u_pixelSize;

vec3 rgb2hsv(vec3 c) {
	const vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	const float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

float colorValue(vec4 color) {
	vec3 hsv = rgb2hsv(color.rgb);
	hsv.x = floor(hsv.x * 15.0) / 15.0;
	return hsv.z > 0.5 ? hsv.x + hsv.z : -hsv.x + hsv.z;
}

void main() {
	// Fragment coord is pixel coord (full resolution)
	ivec2 fragCoord = ivec2(gl_FragCoord.xy);

	// Position map is same resolution as this buffer; decode with cell grid size.
	// In cell-res mode the map stores cell coordinates; in full-res mode it stores
	// screen coordinates (which equal cell coordinates when pixelSize == 1).
	uint idx = texelFetch(u_positionMap, fragCoord, 0).r;
	uint maxIdx = uint(u_resolution.x * u_resolution.y);
	ivec2 mappedPos;
	if (idx < maxIdx) {
		mappedPos = decodePos(idx, ivec2(u_resolution));
	} else {
		// Invalid: use identity
		mappedPos = fragCoord;
	}

	// Convert to screen position for UV lookup (full res: position map stores screen coords)
	ivec2 screenPos = mappedPos;
	vec2 fullCanvasSize = u_resolution;
	vec2 canvasUv = (vec2(screenPos) + 0.5) / fullCanvasSize;
	vec2 inputSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(canvasUv, inputSize);
	vec4 color = texture(u_inputStream, uv);

	float value = colorValue(color);
	outColor = vec4(value, 0.0, 0.0, 1.0);
}
