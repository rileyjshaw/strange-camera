import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import glsl from 'vite-plugin-glsl';

export default {
	plugins: [
		basicSsl(),
		glsl(),
		VitePWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Strange Camera',
				short_name: 'Strange.Cam',
				description:
					'Take weirder photos. Strange Camera is a free app by rileyjshaw with imaginative, playful, and unique camera filters.',
				theme_color: '#bbff35',
			},
		}),
	],
	server: {
		https: true,
		host: true,
	},
};
