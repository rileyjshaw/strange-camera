#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform highp sampler2DArray u_history;
uniform int u_historyFrameOffset;
uniform float u_fadeControl;
uniform float u_colorBleedControl;

float luminance(vec3 color) {
	return dot(clamp(color, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
}

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	vec2 pixel = vec2(1.0) / texSize;
	vec4 webcam = texture(u_inputStream, uv);

	float splitFadeControl = 0.5 - u_fadeControl;
	float fadeSign = sign(splitFadeControl);
	float fade = pow(1.0 - abs(splitFadeControl * 2.0), 3.0) * -fadeSign / 64.0;

	float z = historyZ(u_history, u_historyFrameOffset, 1);
	vec4 prev = texture(u_history, vec3(v_uv, z));

	float webcamLum = fadeSign * luminance(webcam.rgb);
	float prevLum = fadeSign * luminance(prev.rgb);

	vec4 bestNeighbor = webcam;
	float bestNeighborLum = webcamLum;
	for (int dx = -1; dx <= 1; ++dx) {
		for (int dy = -1; dy <= 1; ++dy) {
			vec2 neighborUv = v_uv + vec2(dx, dy) * pixel;
			vec4 neighbor = texture(u_history, vec3(neighborUv, z));
			float neighborLum = fadeSign * luminance(neighbor.rgb);
			if (neighborLum > prevLum) continue;

			vec3 channelDiff = neighbor.rgb - webcam.rgb;
			bvec3 bigDiff = greaterThan(channelDiff - channelDiff.gbr, vec3(pow(1.0 - u_colorBleedControl, 3.0)));
			bvec3 gt = greaterThan(channelDiff, vec3(0.0));
			bvec3 lt = not(gt);
			if (neighborLum < bestNeighborLum && ((gt.r && lt.g && bigDiff.r) || (gt.g && lt.b && bigDiff.g) || (gt.b && lt.r && bigDiff.b))) {
				bestNeighbor = neighbor;
				bestNeighborLum = neighborLum;
			}
		}
	}

	vec4 color = bestNeighborLum <= prevLum ? bestNeighbor : prev;
	outColor = vec4(color.rgb - fade, color.a);
}
