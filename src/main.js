import handleTouch from './handleTouch';
import attachControls from './controls';
import scenes from './scenes';
import wiggleY from './scenes/wiggle y';

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

// “x” is the shorter axis, which corresponds to the actual x axis on a phone.
// These will be lower resolution but there’s more space for multiple controls.
// “y” is the longer axis; higher resolution but space for multiple is limited.
const defaultUserControls = { x1: 0.5, x2: 0.5, x3: 0.5, y1: 0.5, y2: 0.5 };

async function main() {
	// State.
	let currentFacingMode = 'user'; // Selfie camera.
	document.body.classList.add('flipped');
	let isSettingsOpen = false;
	let isShutterHidden = false;

	let shader;
	let videoInput = await getWebcamStream(currentFacingMode);
	let imageInput = null;
	let currentVideoUrl = null;

	let play;

	const app = document.getElementById('app');
	const shutter = document.querySelector('#shutter button');
	app.classList.add('ready');

	document.body.appendChild(videoInput); // HACK: Desktop Safari won’t update the shader otherwise.

	function removeVideoInput() {
		stopWebcamStream();
		if (currentVideoUrl) {
			URL.revokeObjectURL(currentVideoUrl);
			currentVideoUrl = null;
		}
		if (videoInput.parentNode) {
			videoInput.parentNode.removeChild(videoInput);
		}
	}

	function handleImageDrop(event) {
		event.preventDefault();
		const files = event.dataTransfer.files;
		if (files.length > 0) {
			if (files[0].type.startsWith('image/')) {
				handleImageFile(files[0]);
			} else if (files[0].type.startsWith('video/')) {
				handleVideoFile(files[0]);
			}
		}
	}

	function handleImageFile(file) {
		const reader = new FileReader();
		reader.onload = e => {
			const image = new Image();
			image.onload = () => {
				removeVideoInput();
				imageInput = image;
				play = function play() {
					shader.play(() => {
						shader.updateTextures({ u_inputStream: image }); // Silly, but keeps history working.
					});
				};
				play();
			};
			image.src = e.target.result;
		};
		reader.readAsDataURL(file);
	}

	function handleVideoFile(file) {
		removeVideoInput();
		imageInput = null;

		const video = document.createElement('video');
		video.autoplay = video.playsInline = video.muted = video.loop = true;

		currentVideoUrl = URL.createObjectURL(file);
		video.src = currentVideoUrl;

		video.onloadedmetadata = () => {
			videoInput = video;
			document.body.appendChild(videoInput); // HACK: Desktop Safari won't update the shader otherwise.
			play = function play() {
				shader.play(() => {
					shader.updateTextures({ u_inputStream: videoInput });
				});
			};
			play();
			shader.updateTextures({ u_inputStream: videoInput });
		};
	}

	document.body.addEventListener('dragover', e => e.preventDefault());
	document.body.addEventListener('drop', handleImageDrop);

	async function exportHighRes() {
		shader.pause();
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
		const { width: originalWidth, height: originalHeight } = shader.canvas;
		shader.canvas.width = exportWidth;
		shader.canvas.height = exportHeight;
		const gl = shader.canvas.getContext('webgl') || shader.canvas.getContext('webgl2');
		gl.viewport(0, 0, exportWidth, exportHeight);
		shader.draw();
		// TODO: Include a message argument for mobile.
		await shader.save('odd-camera', 'camera.rileyjshaw.com');
		shader.canvas.width = originalWidth;
		shader.canvas.height = originalHeight;
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
		if (videoInput && videoInput.src && !videoInput.srcObject) return;
		removeVideoInput();

		const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
		try {
			videoInput = await getWebcamStream(newFacingMode);
			document.body.appendChild(videoInput); // HACK: Desktop Safari won't update the shader otherwise.
			shader.updateTextures({ u_inputStream: videoInput });
			currentFacingMode = newFacingMode;
			document.body.classList.toggle('flipped', newFacingMode === 'user');
		} catch (error) {
			console.error('Failed to switch camera:', error);
		}
	}
	shutter.addEventListener('click', exportHighRes);

	function toggleSettings() {
		isSettingsOpen = !isSettingsOpen;
		document.body.classList.toggle('settings-open', isSettingsOpen);
	}
	function toggleShutter() {
		isShutterHidden = !isShutterHidden;
		document.body.classList.toggle('shutter-hidden', isShutterHidden);
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
	document.addEventListener('keydown', e => {
		switch (e.key) {
			case 'Escape':
				toggleSettings();
				break;
			case 'h':
			case 'H':
				if (!isSettingsOpen) {
					toggleShutter();
				}
				break;
			case 'ArrowRight':
				if (isSettingsOpen) {
					currentSceneIndex = (currentSceneIndex + 1) % scenes.length;
					cleanupScene = initializeScene(scenes[currentSceneIndex]);
				}
				break;
			case 'ArrowLeft':
				if (isSettingsOpen) {
					currentSceneIndex = (currentSceneIndex - 1 + scenes.length) % scenes.length;
					cleanupScene = initializeScene(scenes[currentSceneIndex]);
				}
				break;
		}
	});

	handleTouch(document.body, {
		async onTap(_x, _y, tapCount, checkFinalTap) {
			if (tapCount < 2) return;
			if (!(await checkFinalTap)) return;
			switch (tapCount) {
				case 2:
					if (!isSettingsOpen) switchCamera();
					break;
				case 3:
					toggleSettings();
					break;
			}
		},
	});

	// Prevent pinch gestures.
	document.addEventListener(
		'touchmove',
		e => {
			if (e.touches.length === 2) e.preventDefault();
		},
		{ passive: false }
	);

	let cleanupScene;
	cleanupScene = initializeScene(scenes[currentSceneIndex]);
	function initializeScene(scene) {
		cleanupScene?.();
		scene.initialize(function setShader(newShader) {
			shader = newShader;
		});
		const userControls = { ...defaultUserControls, ...(scene.controlValues ?? {}) };
		const textureOptions = scene.history ? { history: scene.history } : undefined;
		shader.initializeTexture('u_inputStream', videoInput, textureOptions);
		play = function play() {
			shader.play(() => {
				shader.updateTextures({ u_inputStream: videoInput });
			});
		};
		play();

		const cleanupControls = attachControls(scene, getUpdates => {
			if (isSettingsOpen) return;
			const updates = getUpdates(userControls);
			Object.assign(userControls, updates);
			scene.onUpdate?.(userControls, shader);
		});
		return () => {
			cleanupControls();
			shader.destroy();
		};
	}
}

document.addEventListener('DOMContentLoaded', main);
