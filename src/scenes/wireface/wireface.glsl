#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform sampler2D u_faceMesh;
uniform float u_backgroundColor;
uniform float u_hueRotation;

vec3 rotateHue(vec3 rgb, float rotation) {
	float maxVal = max(rgb.r, max(rgb.g, rgb.b));
	float minVal = min(rgb.r, min(rgb.g, rgb.b));
	float delta = maxVal - minVal;

	float h = 0.0;
	if (delta > 0.0) {
		if (maxVal == rgb.r) {
			h = mod((rgb.g - rgb.b) / delta + (rgb.g < rgb.b ? 6.0 : 0.0), 6.0);
		} else if (maxVal == rgb.g) {
			h = (rgb.b - rgb.r) / delta + 2.0;
		} else {
			h = (rgb.r - rgb.g) / delta + 4.0;
		}
	}
	h /= 6.0;

	h = mod(h + rotation, 1.0);

	float s = maxVal > 0.0 ? delta / maxVal : 0.0;
	float v = maxVal;

	float c = v * s;
	float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
	float m = v - c;

	vec3 rgbOut;
	if (h < 1.0/6.0) {
		rgbOut = vec3(c, x, 0.0);
	} else if (h < 2.0/6.0) {
		rgbOut = vec3(x, c, 0.0);
	} else if (h < 3.0/6.0) {
		rgbOut = vec3(0.0, c, x);
	} else if (h < 4.0/6.0) {
		rgbOut = vec3(0.0, x, c);
	} else if (h < 5.0/6.0) {
		rgbOut = vec3(x, 0.0, c);
	} else {
		rgbOut = vec3(c, 0.0, x);
	}

	return rgbOut + m;
}

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	float bg = step(0.5, u_backgroundColor);
    float cameraMix = 1.0 - abs(u_backgroundColor * 2.0 - 1.0); // Black at 0, full webcam passthrough at 0.5, white at 1.
	vec3 color = mix(vec3(bg), texture(u_inputStream, uv).rgb, cameraMix);
	
	float lineMask = texture(u_faceMesh, uv).r;
	
	vec3 baseLineColor = vec3(0.0, 1.0, 0.0);
	vec3 baseDotColor = vec3(0.0, 0.5, 1.0);
	
	vec3 lineColor = rotateHue(baseLineColor, u_hueRotation);
	vec3 dotColor = rotateHue(baseDotColor, u_hueRotation);
	
	color = mix(color, lineColor, lineMask);
	
	for (int i = 0; i < u_nFaces; ++i) {
		for (int j = 0; j < 478; ++j) {
			vec2 landmarkPos = vec2(faceLandmark(i, j));
			float landmarkDist = distance(uv, landmarkPos);
			float landmarkDot = step(landmarkDist, 0.0015);// + step(landmarkDist, 0.0022) - step(landmarkDist, 0.002);
			color = mix(color, dotColor, landmarkDot);
		}
	}

	outColor = vec4(color, 1.0);
}
