#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform float u_faceScale;
uniform float u_pixelSize;
uniform float u_mode;

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	vec3 camColor = texture(u_inputStream, uv).rgb;
	float nChunks = mix(100.0, 5.0, u_pixelSize);
	float aspectRatio = texSize.x / texSize.y;
	vec2 nChunksVec = aspectRatio > 1.0 ? vec2(nChunks, nChunks / aspectRatio) : vec2(nChunks * aspectRatio, nChunks);
	vec2 chunkedPos = (floor(uv * nChunksVec) + 0.5) / nChunksVec;
	vec3 pixelColor = texture(u_inputStream, chunkedPos).rgb;
	float face = 0.0;
	for (int i = 0; i < u_nFaces; ++i) {
		vec2 faceCenter = vec2(faceLandmark(i, FACE_LANDMARK_FACE_CENTER));
		vec2 faceZoomed = faceCenter + (uv - faceCenter) / u_faceScale;
		face = max(face, inFace(faceZoomed));
	}
	float mixFactor = clamp(abs(1.0 - face - u_mode) * 2.0, 0.0, 1.0);
	outColor = vec4(mix(camColor, pixelColor, mixFactor), 1.0);
}
