#version 300 es
precision highp float;

in vec2 v_uv;
uniform vec2 u_resolution;
uniform sampler2D u_inputStream;
uniform int u_nShuffles;
uniform float u_stepSize;
uniform float u_nStrips;

out vec4 fragColor;

// Triangle wave /\/\/\: [0, 1] -> [0, 1]
vec2 triangle(vec2 xy, vec2 period) {
    return 1.0 - abs(fract(xy * period) * 2.0 - 1.0);
}

// Imagine cutting the image into nStrips strips along the x-axis. Rearrange the strips by taking the first strip,
// then the last strip, then the second strip, then the second last strip, etc. Do the same for the y-axis. This `cutup`
// function is equivalent to running this process nShuffles times. Each step of the process results in a predictable
// column order, so instead of actually iterating, we do it in one shot by aliasing values on a triangle wave.
//
// This solution requires some upfront work on the CPU to calculate the step size, but we only need to do that once. If
// there’s a more elegant solution, I’d be interested to see it. I searched for a weekend and finally gave up. Some
// breadcrumbs:
//
// https://oeis.org/A003558: “…the order of the so-called "milk shuffle" of a deck of n cards”
// https://codegolf.stackexchange.com/questions/207456/hot-moo-shuffle-milk-an-array
// https://codegolf.stackexchange.com/questions/179852/the-465-arrangement
//
// The solution I ended up with isn’t related to the above. All the numbers in a shuffled sequence have a consistent
// stepSize between them on a triangle wave with magnitude nStrips - 0.5. For instance, after shuffling 7 columns twice,
// the order is: 1, 4, 7, 5, 2, 3, 6. All of these numbers intersect with a triangle wave with height 7.5 and a stepSize
// of 3. So with just the stepSize, we can draw the final configuration without having to iterate.
vec2 cutup(vec2 uv, float stepSize, vec2 nStrips) {
    // UV of the pixel relative to the strip it’s in.
    vec2 localUv = mod(uv, 1.0 / nStrips);
    // UV of the strip relative to the canvas (the strip you’d pick up during the shuffle).
    vec2 stripUv = uv - localUv;
    // UV of the strip that we want to draw to (where the strip would land after the shuffle).
    vec2 unquantizedTargetStripUv = triangle(stripUv, (stepSize * nStrips) / (nStrips - 0.5) / 2.0);
    vec2 targetStripUv = round(unquantizedTargetStripUv * (nStrips - 0.5)) / nStrips;
    return targetStripUv + localUv;
}

// Crop the texture to preserve its aspect ratio (object-fit: contain).
vec2 correctAspectRatio(vec2 uv, vec2 resolution, vec2 textureSize) {
    float canvasAspect = resolution.x / resolution.y;
    float textureAspect = textureSize.x / textureSize.y;
    vec2 scale = vec2(min(canvasAspect / textureAspect, 1.0), min(textureAspect / canvasAspect, 1.0));
    return (uv - 0.5) * scale + 0.5;
}

void main() {
    vec2 uv = v_uv;
    // Thinking in terms of the image, you’d want to start by correcting the aspect ratio, then mirroring the image,
    // then rearranging the strips. But since we’re operating in UV space, we need to work backwards.
    uv.y = 1.0 - uv.y; // Make the bottoms touch.
    uv = cutup(uv, u_stepSize, vec2(u_nStrips));
    uv = triangle(uv, vec2(pow(2.0, float(u_nShuffles - 1)))); // Mirror with nShuffles copies.
    uv = correctAspectRatio(uv, u_resolution, vec2(textureSize(u_inputStream, 0)));
    uv = 1.0 - uv;
    fragColor = texture(u_inputStream, uv);
}
