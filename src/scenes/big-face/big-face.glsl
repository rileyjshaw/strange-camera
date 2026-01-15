#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform float u_ratio;
uniform float u_scale;

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	vec2 sampleUv = uv;

	float eyeScale = mix(1.0, u_scale, smoothstep(0.0, 0.5, u_ratio));
	float mouthScale = mix(1.0, u_scale, smoothstep(1.0, 0.5, u_ratio));

	for (int i = 0; i < u_nFaces; ++i) {
		vec2 rightEye = vec2(faceLandmark(i, FACE_LANDMARK_R_EYE_CENTER));
		vec2 rightEyeZoomed = rightEye + (uv - rightEye) / eyeScale;
		vec2 rightEyeResult = rightEyeAt(rightEyeZoomed);
		if (rightEyeResult.x > 0.0 && int(rightEyeResult.y) == i) {
			sampleUv = rightEyeZoomed;
			break;
		}

		vec2 leftEye = vec2(faceLandmark(i, FACE_LANDMARK_L_EYE_CENTER));
		vec2 leftEyeZoomed = leftEye + (uv - leftEye) / eyeScale;
		vec2 leftEyeResult = leftEyeAt(leftEyeZoomed);
		if (leftEyeResult.x > 0.0 && int(leftEyeResult.y) == i) {
			sampleUv = leftEyeZoomed;
			break;
		}

		vec2 mouth = vec2(faceLandmark(i, FACE_LANDMARK_MOUTH_CENTER));
		vec2 mouthZoomed = mouth + (uv - mouth) / mouthScale;
		vec2 mouthResult = outerMouthAt(mouthZoomed);
		if (mouthResult.x > 0.0 && int(mouthResult.y) == i) {
			sampleUv = mouthZoomed;
		}
	}

	sampleUv = clamp(sampleUv, 0.0, 1.0);
	outColor = texture(u_inputStream, sampleUv);
}
