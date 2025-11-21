import fragmentShaderSrc from './wiggle y.glsl';

export default {
	name: 'Wiggle Y',
	controls: [['Number of strips'], ['Delay per strip']],
	fragmentShaderSrc,
	webcamHistory: 196,
};
