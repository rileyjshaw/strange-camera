#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform float u_offsetPixels;

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	vec2 pixel = vec2(1.0) / texSize;
	vec3 color = texture(u_inputStream, uv).rgb;

	float closestCenter = 2.0;
	for (int i = 0; i < u_nFaces; ++i) {
		vec2 dir = uv - u_faceCenter[i]; // Vector from the center of the face to the current pixel.
		float lenDir = length(dir); // Distance from the center of the face to the current pixel.
		if (lenDir >= closestCenter) continue;

		closestCenter = lenDir;
		if (lenDir < 1e-5) {
			dir = vec2(0.0, 1.0); // Avoid divide-by-zero at exact center.
		} else {
			dir /= lenDir; // It looks cool if you comment this out!
		}

		vec2 target = uv;
		vec2 offset = dir * (u_offsetPixels * pixel);
		vec2 overflow = offset * 6.0;
		// Move target away from center until it's outside the face.
		for (int i = 0; i < 1024; ++i) {
			if (length(target - u_faceCenter[i]) > length(overflow)) {
				vec2 nearerTarget = target - overflow;
				if ((getFace(target) + getFace(nearerTarget)) <= 0.0) break; // Exit if neither point is in the face.
			}
			target = clamp(target + offset, 0.0, 1.0);
			if ((target.x <= 0.0 || target.x >= 1.0) || (target.y <= 0.0 || target.y >= 1.0)) break; // Exit if target is at the boundary.
		}
		color = texture(u_inputStream, target).rgb;
	}

	outColor = vec4(color.x, color.y * 1.0, color.z, 1.0);
}
