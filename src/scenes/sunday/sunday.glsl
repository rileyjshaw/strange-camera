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
	
	vec3 eyeColor = vec3(u_color);
	vec3 baseColor = texture(u_inputStream, uv).rgb;
	vec3 color = inEye(uv) > 0.5 ? eyeColor : baseColor;
	
	float maxRadius = 0.05;
	float minDist = 1.0;
	
	for (int i = 0; i < u_nFaces; ++i) {
		vec2 leftEye = vec2(faceLandmark(i, FACE_LANDMARK_L_EYE_CENTER));
		vec2 rightEye = vec2(faceLandmark(i, FACE_LANDMARK_R_EYE_CENTER));
		minDist = min(minDist, min(length(uv - leftEye), length(uv - rightEye)));
	}

	float glowFactor = 1.0 - smoothstep(0.0, maxRadius, minDist);
	glowFactor *= u_glow;

	color = mix(color, eyeColor, glowFactor);	
	outColor = vec4(color, 1.0);
}
