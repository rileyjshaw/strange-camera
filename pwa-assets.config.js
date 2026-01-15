import { combinePresetAndAppleSplashScreens, defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
	headLinkOptions: {
		preset: '2023',
	},
	preset: combinePresetAndAppleSplashScreens(minimal2023Preset, {
		linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/', xhtml: false },
	}),
	images: ['public/favicon-source.svg'],
});
