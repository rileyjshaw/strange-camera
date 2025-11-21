// Inspo: https://timewiggler.com/
import fragmentShaderSrc from './wiggle x.glsl';
export default {
	name: 'Wiggle X',
	controls: [['Number of strips'], ['Delay per strip']],
	fragmentShaderSrc,
	webcamHistory: 196,
};
