#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_inputStream;
uniform float u_refractionIntensity;
uniform float u_nStrips;

out vec4 fragColor;

vec2 refractStrips(vec2 uv, vec2 nStrips) {
    vec2 scaledUv = uv * nStrips;
    vec2 stripUv = floor(scaledUv);
    vec2 localUv = fract(scaledUv);
    vec2 distFromCenter = (stripUv + 0.5 - nStrips / 2.0) / max(nStrips / 2.0 - 0.5, 1.0);
    vec2 offset = distFromCenter * u_refractionIntensity / nStrips;
    offset *= mix(localUv, 1.0 - localUv, step(0.0, distFromCenter));
    return uv - offset;
}

void main() {
    vec2 uv = v_uv;
    uv = refractStrips(uv, vec2(u_nStrips, u_nStrips));
    uv = fitCover(uv, vec2(textureSize(u_inputStream, 0)));
    uv.x = 1.0 - uv.x;
    fragColor = texture(u_inputStream, uv);
}
