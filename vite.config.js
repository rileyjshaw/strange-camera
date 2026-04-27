import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import glsl from 'vite-plugin-glsl';

export default {
	plugins: [
		basicSsl(),
		glsl(),
		VitePWA({
			registerType: 'autoUpdate',
			workbox: {
				cleanupOutdatedCaches: true,
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
				globIgnores: ['**/mediapipe/**/*'],
				navigateFallback: '/index.html',
				runtimeCaching: [
					{
						urlPattern: ({ sameOrigin, url }) =>
							sameOrigin && url.pathname.startsWith('/mediapipe/'),
						handler: 'CacheFirst',
						options: {
							cacheName: 'mediapipe-assets',
							cacheableResponse: {
								statuses: [0, 200],
							},
							expiration: {
								maxEntries: 16,
								maxAgeSeconds: 365 * 24 * 60 * 60,
								purgeOnQuotaError: true,
							},
						},
					},
				],
			},
			manifest: {
				name: 'Strange Camera',
				short_name: 'Strange.Cam',
				description:
					'Take weirder photos. Strange Camera is a free app by rileyjshaw with imaginative, playful, and unique camera filters.',
				theme_color: '#bbff35',
				display: 'standalone',
				start_url: '/',
				scope: '/',
			},
		}),
	],
	server: {
		https: true,
		host: true,
	},
};
