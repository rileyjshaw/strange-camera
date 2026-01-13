// Maps a value from [min, max] range to [0, 1].
export function normalize(min, max, value) {
	return (value - min) / (max - min);
}

// Linear interpolation: returns a value between a and b based on t (0-1).
export function lerp(a, b, t) {
	return a + t * (b - a);
}
