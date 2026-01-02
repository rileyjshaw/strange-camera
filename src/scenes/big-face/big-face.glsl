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
		vec2 mouthZoomed = u_mouth[i] + (uv - u_mouth[i]) / u_scale;
		float mouthValue = getMouth(mouthZoomed);
        if (mouthValue > 0.0) sampleUv = mouthZoomed;
		
		bool isLeftEyeCloser = length(uv - u_leftEye[i]) < length(uv - u_rightEye[i]);
		if (isLeftEyeCloser) {
			vec2 leftEyeZoomed = u_leftEye[i] + (uv - u_leftEye[i]) / u_scale;
			float leftEyeValue = getEye(leftEyeZoomed);
			if (leftEyeValue > 0.6 && leftEyeValue < 0.7) sampleUv = leftEyeZoomed;
		} else {
			vec2 rightEyeZoomed = u_rightEye[i] + (uv - u_rightEye[i]) / u_scale;
			float rightEyeValue = getEye(rightEyeZoomed);
			if (rightEyeValue > 0.8 && rightEyeValue < 0.9) sampleUv = rightEyeZoomed;
		}
	}

	sampleUv = clamp(sampleUv, 0.0, 1.0);
	outColor = texture(u_inputStream, sampleUv);
}
