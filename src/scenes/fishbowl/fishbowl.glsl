#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform vec2 u_resolution;

const float PI = 3.14159265358979323846;

vec2 sphereSampleUvFixedCircle(vec2 uv, vec2 resolution) {
	float minDim = min(resolution.x, resolution.y);
	float radiusPx = (5.0 / 6.0) * 0.5 * minDim;

	vec2 fragPx = uv * resolution;
	vec2 centerPx = 0.5 * resolution;
	vec2 p = (fragPx - centerPx) / radiusPx;

	float r2 = dot(p, p);
	if (r2 > 1.0) return vec2(-1.0);

	float z = sqrt(1.0 - r2);
	vec3 s = vec3(p.x, p.y, z);

	float lon = atan(s.x, s.z);
	float lat = asin(s.y);

	return vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
}

void main() {
	vec2 sampleUv = sphereSampleUvFixedCircle(v_uv, u_resolution);
	if (sampleUv.x < 0.0) {
		outColor = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}
	outColor = texture(u_inputStream, sampleUv);
}
