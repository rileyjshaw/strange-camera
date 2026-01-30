#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform float u_color;
uniform float u_glow;

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	vec2 scale = texSize.x > texSize.y ? vec2(1.0, texSize.x / texSize.y) : vec2(texSize.y / texSize.x, 1.0);

	float minDist = 1.0;
	for (int i = 0; i < u_nFaces; ++i) {
		vec2 leftEye = vec2(faceLandmark(i, FACE_LANDMARK_L_EYE_CENTER));
		vec2 rightEye = vec2(faceLandmark(i, FACE_LANDMARK_R_EYE_CENTER));
		minDist = min(
			minDist,
			min(
				length((uv - leftEye) / scale),
				length((uv - rightEye) / scale)
			)
		);
	}

	vec3 inputColor = texture(u_inputStream, uv).rgb;
	float eyeFadeFactor = smoothstep(0.002, 0.04, minDist);
	float glowFactor = clamp(minDist * 12.0 * (2.0 - u_glow), 0.1, 1.0);
	if (u_color > 0.5) {
		glowFactor = 1.0 / glowFactor;
	}
	vec3 color = vec3(mix(u_color, 0.2, eyeFadeFactor)); // Eye color.
	color = mix(inputColor, color, inEye(uv)); // Mask to eyes.
	color = color * mix(1.0, glowFactor, u_glow * abs(u_color - 0.5) * 2.0); // Add glow.

	outColor = vec4(color, 1.0);
}
