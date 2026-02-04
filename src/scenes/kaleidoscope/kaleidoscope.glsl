// Kaleidoscope effect – four scope shapes (equilateral, square, isosceles, scalene).
// Adapted from https://github.com/leifgehrmann/kaleidoscope.

#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform float u_rotation;
uniform float u_scale;
uniform int u_scopeShape;
uniform vec2 u_offset;

#define PI 3.14159265358979323846
#define TAU 6.28318530717958647692
const float SQRT2 = sqrt(2.0);
const float SQRT3 = sqrt(3.0);

float round_(float v) {
	return floor(v + 0.5);
}

vec2 rotate2d(vec2 u, float theta) {
	theta = theta * TAU;
	return vec2(
		cos(theta) * u.x - sin(theta) * u.y,
		sin(theta) * u.x + cos(theta) * u.y
	);
}

vec2 axial_round(vec2 pos) {
	float xGrid = round_(pos.x);
	float yGrid = round_(pos.y);
	pos.x -= xGrid;
	pos.y -= yGrid;
	float dx = round_(pos.x + 0.5 * pos.y) * (pos.x * pos.x >= pos.y * pos.y ? 1.0 : 0.0);
	float dy = round_(pos.y + 0.5 * pos.x) * (pos.x * pos.x < pos.y * pos.y ? 1.0 : 0.0);
	return vec2(xGrid + dx, yGrid + dy);
}

vec2 square_float_to_axial_hex_grid(vec2 pos, bool pointyTop) {
	float ratio = 2.0 / 3.0;
	if (pointyTop) {
		pos.x = ratio * 0.5 * (SQRT3 * pos.x - pos.y);
		pos.y *= ratio;
	} else {
		pos.y = ratio * 0.5 * (SQRT3 * pos.y - pos.x);
		pos.x *= ratio;
	}
	return axial_round(pos);
}

vec2 hexToCentroid(vec2 hex, bool pointyTop) {
	float size = 2.0 / 3.0;
	if (pointyTop) {
		return vec2(
			hex.x * 2.0 / SQRT3 / size + hex.y / SQRT3 / size,
			hex.y / size
		);
	} else {
		return vec2(
			hex.x / size,
			hex.y * 2.0 / SQRT3 / size + hex.x / SQRT3 / size
		);
	}
}

vec2 square_k(vec2 u, float kLength, float kRot, vec2 offset) {
	u -= vec2(0.5, 0.5);
	u = rotate2d(u, kRot);
	u /= kLength;
	u += vec2(0.5, 0.5);

	u.x *= SQRT2;
	u.y *= SQRT2;
	u += vec2((1.0 - SQRT2) / 2.0, (1.0 - SQRT2) / 2.0);

	u += offset;

	float kOffset = (1.0 / 1.0 - 1.0) / (1.0 / 1.0 * 2.0);
	vec2 k = vec2(0.0, 0.0);
	if (mod(-kOffset + u.x, 1.0 * 2.0) > 1.0) {
		k.x = 1.0 - mod(-kOffset + u.x, 1.0) / 1.0;
	} else {
		k.x = mod(-kOffset + u.x, 1.0) / 1.0;
	}
	if (mod(-kOffset + u.y, 1.0 * 2.0) > 1.0) {
		k.y = 1.0 - mod(-kOffset + u.y, 1.0) / 1.0;
	} else {
		k.y = mod(-kOffset + u.y, 1.0) / 1.0;
	}
	return k;
}

vec2 equilateral_k(vec2 u, float kLength, float kRot, vec2 offset) {
	u -= vec2(0.5, 0.5);
	u = rotate2d(u, kRot);
	u /= kLength;
	u /= SQRT3 / 2.0;

	u += vec2(0.5, 0.5);
	u.y -= (0.25) * SQRT3 / 2.0;

	u += offset;

	vec2 hexIndex = square_float_to_axial_hex_grid(u, false);
	vec2 hexCentroid = hexToCentroid(hexIndex, false);

	float dist = distance(hexCentroid, u);
	float deg180 = PI;
	float deg60 = deg180 / 3.0;
	float theta = atan(u.x - hexCentroid.x, u.y - hexCentroid.y) + deg180 + deg60 / 2.0;
	if (mod(theta, deg60 * 2.0) > deg60) {
		theta = mod(theta, deg60);
	} else {
		theta = deg60 - mod(theta, deg60);
	}

	vec2 k = vec2(cos(theta) * dist, sin(theta) * dist);
	k *= cos(radians(30.0));
	k.x += ((1.0 - SQRT3 / 2.0) / 2.00);
	k.y += 0.254;

	return k;
}

vec2 isosceles_k(vec2 u, float kLength, float kRot, vec2 offset) {
	u -= vec2(0.5, 0.5);
	u = rotate2d(u, kRot);
	u /= kLength;
	u *= SQRT2 / 2.0;

	u += vec2(0.5, 0.5);
	u -= 0.25;

	u += offset;

	vec2 squareCentroid = vec2(round_(u.x), round_(u.y));
	float dist = distance(squareCentroid, u) * 2.0;
	float deg180 = PI;
	float deg45 = deg180 / 4.0;
	float theta = atan(u.x - squareCentroid.x, u.y - squareCentroid.y) * 0.99999;
	if (mod(theta, deg45 * 2.0) > deg45) {
		theta = deg45 - mod(theta, deg45);
	} else {
		theta = mod(theta, deg45);
	}

	vec2 k = vec2(cos(theta) * dist, sin(theta) * dist);
	return k;
}

vec2 scalene_k(vec2 u, float kLength, float kRot, vec2 offset) {
	u -= 0.5;
	u = rotate2d(u, kRot + radians(60.0));
	u /= kLength;
	u += 0.5;

	u.x -= sin(radians(90.0)) * 0.50;
	u.y -= cos(radians(90.0)) * 0.50;

	u += offset;

	vec2 hexIndex = square_float_to_axial_hex_grid(u, true);
	vec2 hexCentroid = hexToCentroid(hexIndex, true);

	float dist = distance(hexCentroid, u) * 2.0 / SQRT3;
	float deg180 = PI;
	float deg30 = deg180 / 6.0;
	float theta = atan(u.x - hexCentroid.x, u.y - hexCentroid.y) + deg180;
	if (mod(theta, deg30 * 2.0) > deg30) {
		theta = mod(theta, deg30);
	} else {
		theta = deg30 - mod(theta, deg30);
	}

	vec2 k = vec2(cos(theta) * dist, sin(theta) * dist);
	k *= SQRT3 / 2.0;
	k.x += ((1.0 - SQRT3 / 2.0) / 2.0);
	k.y += 0.25;

	return k;
}

// Tiling period for offset looping per shape (so [0,1] input loops cleanly)
vec2 getOffsetPeriod(int shape) {
	if (shape == 0) return vec2(3.0, SQRT3);   // equilateral (flat-top hex)
	if (shape == 1) return vec2(2.0, 2.0);         // square
	if (shape == 2) return vec2(1.0, 1.0);         // isosceles
	return vec2(3.0 * SQRT3, 3.0);             // scalene (pointy-top hex)
}

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));

	// Screen UV: bottom-left origin to match reference
	vec2 u = vec2(v_uv.x, 1.0 - v_uv.y);
	// Correct aspect so the scope is circular on screen (no stretch)
	float minDim = min(u_resolution.x, u_resolution.y);
	if (minDim > 0.0) {
		u = (u - 0.5) * (u_resolution / minDim) + 0.5;
	}
	vec2 k = u;

	// Scale offset from [0,1] to shape's tiling period for clean looping
	vec2 period = getOffsetPeriod(u_scopeShape);
	vec2 d = u_offset * period;

	if (u_scopeShape == 0) {
		k = equilateral_k(u, u_scale, u_rotation, d);
	} else if (u_scopeShape == 1) {
		k = square_k(u, u_scale, u_rotation, d);
	} else if (u_scopeShape == 2) {
		k = isosceles_k(u, u_scale, u_rotation, d);
	} else {
		k = scalene_k(u, u_scale, u_rotation, d);
	}

	// Map kaleidoscope space k [0,1] to texture UV: center and rotate (zoom is applied inside shape)
	vec2 sampleUV = 0.5 + rotate2d(k - 0.5, u_rotation);
	sampleUV = fitCover(sampleUV, texSize);

	outColor = texture(u_inputStream, sampleUV);
}
