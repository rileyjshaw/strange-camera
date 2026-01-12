#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform vec2 u_resolution;
uniform float u_shadow;

const float PI = 3.14159265358979323846;

vec3 fishbowl(vec2 uv, vec2 resolution) {
	float minDim = min(resolution.x, resolution.y);
	float radiusPx = (5.0 / 6.0) * 0.5 * minDim;

	vec2 fragPx = uv * resolution;
	vec2 centerPx = 0.5 * resolution;
	vec2 distFromCenter = (fragPx - centerPx);
	// Position on the disk. (0,0) is center, length of 1 is edge.
	vec2 diskPos = distFromCenter / radiusPx;

	float diskRadiusSq = dot(diskPos, diskPos);
	float brightness = 1.0;
	if (diskRadiusSq > 1.0) {
		float r = sqrt(diskRadiusSq);
		diskPos /= r;
		diskRadiusSq = 1.0;
		float distToEdge = abs((length(distFromCenter) - radiusPx) / (length(centerPx) - radiusPx));
		float stepFrom = max(0.0, (u_shadow - 0.5) * 2.0);
		float stepTo = min(1.0, u_shadow * 2.0);
		brightness = smoothstep(stepFrom, stepTo, distToEdge);
	}
	float z = sqrt(1.0 - diskRadiusSq);
	vec3 spherePos = vec3(diskPos.x, diskPos.y, z);

	float lon = atan(spherePos.x, spherePos.z);
	float lat = asin(spherePos.y);

	return vec3(lon / (2.0 * PI) + 0.5, lat / PI + 0.5, brightness);
}

void main() {
	vec3 sphere = fishbowl(v_uv, u_resolution);
	outColor = texture(u_inputStream, sphere.xy) * sphere.z;
}
