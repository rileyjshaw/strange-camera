import ShaderPad from 'shaderpad';
import { helpers } from 'shaderpad/plugins/helpers';
import { save } from 'shaderpad/plugins/save';
import handleTouch from './handleTouch';
import attachControls from './controls';
import wiggleX from './wiggle x';
import wiggleY from './wiggle y';

const scenes = [wiggleX, wiggleY].sort((a, b) => a.name.localeCompare(b.name));
let currentSceneIndex = scenes.indexOf(wiggleY);

const MAX_EXPORT_DIMENSION = 4096;

async function getWebcamStream(facingMode = 'user') {
	const video = document.createElement('video');
	video.autoplay = video.playsInline = video.muted = true;

	try {
		const constraints = {
			video: {
				facingMode,
				width: { ideal: 1280, max: 1920 },
			},
		};
		const stream = await navigator.mediaDevices.getUserMedia(constraints);
		video.srcObject = stream;
		await new Promise(resolve => (video.onloadedmetadata = resolve));
	} catch (error) {
		console.error('Error accessing webcam:', error);
		throw error;
	}

	return video;
}

async function main() {
	// State.
	let currentFacingMode = 'user'; // Selfie camera.
	let isSettingsOpen = false;
	let keyboardControlGroup = 1;
	const userControls = { x1: 0.5, x2: 0.5, x3: 0.5, y1: 0.5, y2: 0.5, y3: 0.5 };

	let displayShader;
	let videoInput = await getWebcamStream(currentFacingMode);
	let imageInput = null;

	let play;

	const app = document.getElementById('app');
	const shutter = document.querySelector('#shutter button');
	app.classList.add('ready');

	document.body.appendChild(videoInput); // HACK: Desktop Safari won’t update the shader otherwise.

	function removeVideoInput() {
		stopWebcamStream();
		if (videoInput.parentNode) {
			videoInput.parentNode.removeChild(videoInput);
		}
	}

	function handleImageDrop(event) {
		event.preventDefault();
		const files = event.dataTransfer.files;
		if (files.length > 0 && files[0].type.startsWith('image/')) {
			handleImageFile(files[0]);
		}
	}

	// TODO: Add video file handling.
	function handleImageFile(file) {
		const reader = new FileReader();
		reader.onload = e => {
			const image = new Image();
			image.onload = () => {
				removeVideoInput();
				imageInput = image;
				play = () => displayShader.play();
				play();
				displayShader.updateTextures({ u_inputStream: image });
			};
			image.src = e.target.result;
		};
		reader.readAsDataURL(file);
	}

	document.body.addEventListener('dragover', e => e.preventDefault());
	document.body.addEventListener('drop', handleImageDrop);

	async function exportHighRes() {
		displayShader.pause();
		let exportWidth, exportHeight;
		if (imageInput) {
			exportWidth = imageInput.naturalWidth;
			exportHeight = imageInput.naturalHeight;
		} else {
			exportWidth = videoInput.videoWidth;
			exportHeight = videoInput.videoHeight;
		}

		if (exportWidth > MAX_EXPORT_DIMENSION || exportHeight > MAX_EXPORT_DIMENSION) {
			const aspectRatio = exportWidth / exportHeight;
			if (exportWidth > exportHeight) {
				exportWidth = MAX_EXPORT_DIMENSION;
				exportHeight = Math.round(MAX_EXPORT_DIMENSION / aspectRatio);
			} else {
				exportHeight = MAX_EXPORT_DIMENSION;
				exportWidth = Math.round(MAX_EXPORT_DIMENSION * aspectRatio);
			}
		}
		const { width: originalWidth, height: originalHeight } = displayShader.canvas;
		displayShader.canvas.width = exportWidth;
		displayShader.canvas.height = exportHeight;
		const gl = displayShader.canvas.getContext('webgl') || displayShader.canvas.getContext('webgl2');
		gl.viewport(0, 0, exportWidth, exportHeight);
		displayShader.draw();
		// TODO: Include a message argument for mobile.
		await displayShader.save('odd-camera', 'camera.rileyjshaw.com');
		displayShader.canvas.width = originalWidth;
		displayShader.canvas.height = originalHeight;
		gl.viewport(0, 0, originalWidth, originalHeight);
		play();
	}

	function stopWebcamStream() {
		if (videoInput.srcObject) {
			videoInput.srcObject.getTracks().forEach(track => track.stop());
		}
	}

	async function switchCamera() {
		if (imageInput) return;
		stopWebcamStream();

		const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
		try {
			videoInput = await getWebcamStream(newFacingMode);
			displayShader.updateTextures({ u_inputStream: videoInput });
			currentFacingMode = newFacingMode;
			document.body.classList.toggle('flipped', newFacingMode === 'environment');
		} catch (error) {
			console.error('Failed to switch camera:', error);
		}
	}

	document.addEventListener('keydown', e => {
		let key = null;
		switch (e.key) {
			case 'Escape':
				toggleSettings();
				break;
			case 'C':
			case 'c':
				switchCamera();
			case '1':
				keyboardControlGroup = 1;
				break;
			case '2':
				keyboardControlGroup = 2;
				break;
			case '3':
				keyboardControlGroup = 3;
				break;
			case 'ArrowUp':
				key = `y${keyboardControlGroup}`;
				userControls[key] = Math.max(0, Math.min(1, userControls[key] + 0.01));
				displayShader.updateUniforms({ [key]: userControls[key] });
				break;
			case 'ArrowDown':
				key = `y${keyboardControlGroup}`;
				userControls[key] = Math.max(0, Math.min(1, userControls[key] - 0.01));
				displayShader.updateUniforms({ [key]: userControls[key] });
				break;
			case 'ArrowRight':
				if (isSettingsOpen) {
					currentSceneIndex = (currentSceneIndex + 1) % scenes.length;
					cleanupScene = initializeScene(scenes[currentSceneIndex]);
				} else {
					key = `x${keyboardControlGroup}`;
					userControls[key] = Math.max(0, Math.min(1, userControls[key] + 0.01));
					displayShader.updateUniforms({ [key]: userControls[key] });
				}
				break;
			case 'ArrowLeft':
				if (isSettingsOpen) {
					currentSceneIndex = (currentSceneIndex - 1 + scenes.length) % scenes.length;
					cleanupScene = initializeScene(scenes[currentSceneIndex]);
				} else {
					key = `x${keyboardControlGroup}`;
					userControls[key] = Math.max(0, Math.min(1, userControls[key] - 0.01));
					displayShader.updateUniforms({ [key]: userControls[key] });
				}
				break;
		}
	});
	shutter.addEventListener('click', exportHighRes);

	function toggleSettings() {
		isSettingsOpen = !isSettingsOpen;
		document.body.classList.toggle('settings-open', isSettingsOpen);
	}

	handleTouch(
		document.getElementById('settings'),
		{
			onMove(direction, diff) {
				if (direction === 'y') return;
				currentSceneIndex = (currentSceneIndex + Math.sign(diff) + scenes.length) % scenes.length;
				cleanupScene = initializeScene(scenes[currentSceneIndex]);
			},
		},
		{ once: true, moveThresholdPx: 100 }
	);

	handleTouch(document.body, {
		async onTap(_x, _y, tapCount, checkFinalTap) {
			if (tapCount < 2) return;
			if (!(await checkFinalTap)) return;
			switch (tapCount) {
				case 2:
					switchCamera();
					break;
				case 3:
					toggleSettings();
					break;
			}
		},
	});

	let cleanupScene;
	cleanupScene = initializeScene(scenes[currentSceneIndex]);
	function initializeScene(scene) {
		cleanupScene?.();
		displayShader = new ShaderPad(scene.fragmentShaderSrc, { plugins: [helpers(), save()] });
		Object.entries(userControls).forEach(([key, val]) => {
			displayShader.initializeUniform(key, 'float', val);
		});
		const textureOptions = scene.webcamHistory ? { history: scene.webcamHistory } : undefined;
		displayShader.initializeTexture('u_inputStream', videoInput, textureOptions);
		play = function play() {
			displayShader.play(() => {
				displayShader.updateTextures({ u_inputStream: videoInput });
			});
		};
		play();

		const cleanupControls = attachControls(scene, getUpdates => {
			const updates = getUpdates(userControls);
			Object.assign(userControls, updates);
			displayShader.updateUniforms(updates);
		});
		return () => {
			cleanupControls();
			displayShader.destroy();
		};
	}
}

document.addEventListener('DOMContentLoaded', main);
