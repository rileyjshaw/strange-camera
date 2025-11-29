#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform highp sampler2DArray u_history;
uniform int u_historyFrameOffset;
uniform int u_frame;
uniform float u_offsetPixels;

void main() {
	vec2 uv = v_uv;
	vec2 pixel = vec2(1.0) / vec2(textureSize(u_inputStream, 0));
	vec3 color = texture(u_inputStream, uv).rgb;

	float closestCenter = 2.0;
	for (int i = 0; i < u_nPoses; ++i) {
		vec2 dir = uv - u_poseCenter[i];
		float lenDir = length(dir);
		if (lenDir >= closestCenter) continue;

		closestCenter = lenDir;
		if (lenDir < 1e-5) {
			dir = vec2(0.0, 1.0); // Avoid divide-by-zero at exact center.
		} else {
			dir /= lenDir; // It looks cool if you comment this out!
		}

		vec2 uvNearerPoseCenter = uv - dir * 80.0 * pixel;
		float body = getBody(uv) + getBody(uvNearerPoseCenter);
		if (body > 0.0) {
			vec2 target = uv + dir * (u_offsetPixels * pixel); // Grab the color away from your body center.
			float z = historyZ(u_history, u_historyFrameOffset, 1);
			color = texture(u_history, vec3(target, z)).rgb;
		}
	}

	outColor = vec4(color.x, color.y * 1.0, color.z, 1.0);
}

