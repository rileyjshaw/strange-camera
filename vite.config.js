import basicSsl from '@vitejs/plugin-basic-ssl';
import glsl from 'vite-plugin-glsl';

export default {
	base: '/strange-camera/',
	plugins: [basicSsl(), glsl()],
	server: {
		https: true,
		host: true,
	},
};
