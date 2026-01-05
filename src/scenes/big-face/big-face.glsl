#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform float u_scale;

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	vec2 sampleUv = uv;

	for (int i = 0; i < u_nFaces; ++i) {
		vec2 mouth = vec2(faceLandmark(i, FACE_LANDMARK_MOUTH_CENTER));
		vec2 mouthZoomed = mouth + (uv - mouth) / u_scale;
		float mouthValue = inMouth(mouthZoomed);
        if (mouthValue > 0.0) sampleUv = mouthZoomed;
		
		vec2 leftEye = vec2(faceLandmark(i, FACE_LANDMARK_L_EYE_CENTER));
		vec2 rightEye = vec2(faceLandmark(i, FACE_LANDMARK_R_EYE_CENTER));
		bool isLeftEyeCloser = length(uv - leftEye) < length(uv - rightEye);
		if (isLeftEyeCloser) {
			vec2 leftEyeZoomed = leftEye + (uv - leftEye) / u_scale;
			float leftEyeValue = inEye(leftEyeZoomed);
			if (leftEyeValue > 0.6 && leftEyeValue < 0.7) sampleUv = leftEyeZoomed;
		} else {
			vec2 rightEyeZoomed = rightEye + (uv - rightEye) / u_scale;
			float rightEyeValue = inEye(rightEyeZoomed);
			if (rightEyeValue > 0.8 && rightEyeValue < 0.9) sampleUv = rightEyeZoomed;
		}
	}

	sampleUv = clamp(sampleUv, 0.0, 1.0);
	outColor = texture(u_inputStream, sampleUv);
}
