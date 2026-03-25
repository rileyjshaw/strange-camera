import maskBlueNoise8 from './masks/blue-noise-8.webp?url&no-inline';
import maskBlueNoise16 from './masks/blue-noise-16.webp?url&no-inline';
import maskBlueNoise32 from './masks/blue-noise-32.webp?url&no-inline';
import maskBlueNoise64 from './masks/blue-noise-64.webp?url&no-inline';
import maskBlueNoise128 from './masks/blue-noise-128.webp?url&no-inline';
import maskBlueNoise256 from './masks/blue-noise-256.webp?url&no-inline';
import maskBlueNoise512 from './masks/blue-noise-512.webp?url&no-inline';
import maskTiledNoise8 from './masks/tiled-noise-8.webp?url&no-inline';
import maskTiledNoise16 from './masks/tiled-noise-16.webp?url&no-inline';
import maskTiledNoise32 from './masks/tiled-noise-32.webp?url&no-inline';
import maskTiledNoise64 from './masks/tiled-noise-64.webp?url&no-inline';
import maskTiledNoise128 from './masks/tiled-noise-128.png?url&no-inline';
import maskTiledNoise256 from './masks/tiled-noise-256.webp?url&no-inline';
import maskRSequence4 from './masks/r-sequence-4.webp?url&no-inline';
import maskRSequence8 from './masks/r-sequence-8.webp?url&no-inline';
import maskRSequence16 from './masks/r-sequence-16.webp?url&no-inline';
import maskRSequence24 from './masks/r-sequence-24.webp?url&no-inline';
import maskRSequence32 from './masks/r-sequence-32.webp?url&no-inline';
import maskRSequence48 from './masks/r-sequence-48.webp?url&no-inline';

export default {
	'blue-noise': {
		sizes: [8, 16, 32, 64, 128, 256, 512],
		entries: {
			'8': maskBlueNoise8,
			'16': maskBlueNoise16,
			'32': maskBlueNoise32,
			'64': maskBlueNoise64,
			'128': maskBlueNoise128,
			'256': maskBlueNoise256,
			'512': maskBlueNoise512,
		},
	},
	'tiled-noise': {
		sizes: [8, 16, 32, 64, 128, 256],
		entries: {
			'8': maskTiledNoise8,
			'16': maskTiledNoise16,
			'32': maskTiledNoise32,
			'64': maskTiledNoise64,
			'128': maskTiledNoise128,
			'256': maskTiledNoise256,
		},
	},
	'r-sequence': {
		sizes: [4, 8, 16, 24, 32, 48],
		entries: {
			'4': maskRSequence4,
			'8': maskRSequence8,
			'16': maskRSequence16,
			'24': maskRSequence24,
			'32': maskRSequence32,
			'48': maskRSequence48,
		},
	},
};
