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

	float maxRadius = 0.1;
	float minDist = 1.0;
	for (int i = 0; i < u_nFaces; ++i) {
		vec2 leftEye = vec2(faceLandmark(i, FACE_LANDMARK_L_EYE_CENTER));
		vec2 rightEye = vec2(faceLandmark(i, FACE_LANDMARK_R_EYE_CENTER));
		minDist = min(minDist, min(length(uv - leftEye), length(uv - rightEye)));
	}

	vec3 inputColor = texture(u_inputStream, uv).rgb;
	float eyeFadeFactor = smoothstep(0.002, 0.05, minDist);
	vec3 eyeColor = vec3(mix(u_color, 0.5, eyeFadeFactor));
	vec3 color = mix(inputColor, eyeColor, inEye(uv));

	float glowFactor = 1.2 * pow(smoothstep(maxRadius, 0.0, minDist), 3.0);
	glowFactor *= u_glow;

	color = mix(color, vec3(u_color), glowFactor);
	outColor = vec4(color, 1.0);
}
