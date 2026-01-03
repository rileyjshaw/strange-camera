#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_inputStream;
uniform float u_color;

void main() {
	vec2 texSize = vec2(textureSize(u_inputStream, 0));
	vec2 uv = fitCover(v_uv, texSize);
	
	vec3 eyeColor = vec3(u_color);
	vec3 baseColor = texture(u_inputStream, uv).rgb;
	vec3 color = getEye(uv) > 0.5 ? eyeColor : baseColor;
	
	outColor = vec4(color, 1.0);
}
