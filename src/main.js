import handleTouch from './handleTouch';
import attachControls from './controls';
import saveVideo from './saveVideo';
import scenes, { sceneHashToIndex } from './scenes';

function updateUrlHash(scene) {
	window.location.hash = scene.hash;
}

const urlHash = window.location.hash.slice(1);
let currentSceneIndex = sceneHashToIndex.get(urlHash) ?? Math.floor(Math.random() * scenes.length);

const MAX_EXPORT_DIMENSION = 4096;
const HOLD_THRESHOLD_MS = 300;

let hasCameraPermission = false;
let audioStream = null;

async function getAudioStream() {
	try {
		audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		return audioStream;
	} catch {
		return null;
	}
}

async function getCameraStream(facingMode = 'user', deviceId = null) {
	const video = document.createElement('video');
	video.autoplay = video.playsInline = video.muted = true;

	try {
		const constraints = {
			video: deviceId
				? { deviceId: { exact: deviceId }, width: { ideal: 1280, max: 1920 } }
				: { facingMode, width: { ideal: 1280, max: 1920 } },
		};
		const stream = await navigator.mediaDevices.getUserMedia(constraints);
		hasCameraPermission = true;
		video.srcObject = stream;
		await new Promise(resolve => (video.onloadedmetadata = resolve));
	} catch (error) {
		console.error('Error accessing webcam:', error);
		throw error;
	}

	return video;
}

function guessCameraFacing(device) {
	const label = device.label.toLowerCase();
	if (label.includes('front') || label.includes('user')) return 'user';
	if (label.includes('back') || label.includes('rear')) return 'environment';
	return 'user';
}

async function listCameras() {
	if (!hasCameraPermission) {
		throw new Error('Webcam stream not yet obtained');
	}
	const devices = await navigator.mediaDevices.enumerateDevices();
	return devices.filter(d => d.kind === 'videoinput');
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
	let isControlsHidden = false;

	let allCameras = [];
	let camerasByFacingMode = { user: [], environment: [] };
	let currentCameraIndex = { user: 0, environment: 0 };
	let currentDeviceId = null;
	let hasBothFacingModes = false;

	let shader;
	let videoInput = await getCameraStream(currentFacingMode);
	let imageInput = null;
	let currentVideoUrl = null;

	let isRecording = false;
	let isRecordLocked = false;
	let mediaRecorder = null;
	let recordedChunks = [];
	let recordingStartTime = null;
	let recordingTimerInterval = null;
	const recordingTimeEl = document.querySelector('.recording-time');
	const recordLockEl = document.querySelector('#record-lock');

	let play;

	const app = document.getElementById('app');
	const settingsEl = document.getElementById('settings');
	const titleEl = document.getElementById('title');
	const canvas = document.querySelector('canvas');
	const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });

	const shutterButton = document.querySelector('#shutter');
	const openMenuButton = document.querySelector('#open-menu');
	const flipCameraButton = document.querySelector('#flip-camera');
	const scenePrev = document.querySelector('#scene-prev');
	const sceneNext = document.querySelector('#scene-next');
	const goButton = document.querySelector('#go-button');
	app.classList.add('ready');

	function updateFlipCameraButton() {
		flipCameraButton.disabled = allCameras.length <= 1;
	}

	async function updateCameraList() {
		allCameras = await listCameras();
		camerasByFacingMode.user = [];
		camerasByFacingMode.environment = [];

		for (const camera of allCameras) {
			const facing = guessCameraFacing(camera);
			camerasByFacingMode[facing].push(camera);
		}

		hasBothFacingModes = camerasByFacingMode.user.length > 0 && camerasByFacingMode.environment.length > 0;
		updateFlipCameraButton();
	}

	await updateCameraList();
	if (videoInput.srcObject) {
		const track = videoInput.srcObject.getVideoTracks()[0];
		if (track) {
			currentDeviceId = track.getSettings().deviceId;
			const cameras = camerasByFacingMode[currentFacingMode];
			const index = cameras.findIndex(c => c.deviceId === currentDeviceId);
			if (index !== -1) {
				currentCameraIndex[currentFacingMode] = index;
			} else if (cameras.length > 0) {
				currentCameraIndex[currentFacingMode] = 0;
			}
		}
	}

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
		const sceneName = scenes[currentSceneIndex].name;
		window.posthog?.capture('take_photo', { scene: sceneName });
		shader.pause();
		const { width: canvasWidth, height: canvasHeight } = shader.canvas;
		let exportWidth = canvasWidth,
			exportHeight = canvasHeight;
		const needsResize = exportWidth > MAX_EXPORT_DIMENSION || exportHeight > MAX_EXPORT_DIMENSION;
		if (needsResize) {
			const aspectRatio = exportWidth / exportHeight;
			if (aspectRatio > 1) {
				exportWidth = MAX_EXPORT_DIMENSION;
				exportHeight = Math.round(MAX_EXPORT_DIMENSION / aspectRatio);
			} else {
				exportHeight = MAX_EXPORT_DIMENSION;
				exportWidth = Math.round(MAX_EXPORT_DIMENSION * aspectRatio);
			}
			shader.canvas.width = exportWidth;
			shader.canvas.height = exportHeight;
			gl.viewport(0, 0, exportWidth, exportHeight);
			shader.draw();
		}
		await shader.save(`Strange Camera - ${sceneName}`, window.location.href);
		if (needsResize) {
			shader.canvas.width = canvasWidth;
			shader.canvas.height = canvasHeight;
			gl.viewport(0, 0, canvasWidth, canvasHeight);
		}
		play();
	}

	async function startRecording() {
		if (isRecording) return;

		const sceneName = scenes[currentSceneIndex].name;
		window.posthog?.capture('start_recording', { scene: sceneName });

		if (!audioStream) {
			await getAudioStream();
		}

		recordedChunks = [];

		const canvasStream = canvas.captureStream(30);
		const tracks = [...canvasStream.getVideoTracks()];
		if (audioStream) {
			tracks.push(...audioStream.getAudioTracks());
		}
		const combinedStream = new MediaStream(tracks);

		const mimeTypes = [
			'video/mp4;codecs=avc1,mp4a.40.2',
			'video/mp4',
			'video/webm;codecs=vp9,opus',
			'video/webm;codecs=vp8,opus',
			'video/webm',
		];
		let mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

		mediaRecorder = new MediaRecorder(combinedStream, {
			mimeType,
			videoBitsPerSecond: 2_500_000,
			audioBitsPerSecond: 128_000,
		});

		mediaRecorder.ondataavailable = event => {
			if (event.data.size > 0) {
				recordedChunks.push(event.data);
			}
		};

		const recorderMimeType = mediaRecorder.mimeType || mimeType;
		mediaRecorder.onstop = () => {
			if (recordedChunks.length === 0) return;
			const blob = new Blob(recordedChunks, { type: recorderMimeType });
			const extension = recorderMimeType.includes('mp4') ? 'mp4' : 'webm';
			const filename = `Strange Camera - ${sceneName}.${extension}`;
			saveVideo(blob, filename);
			recordedChunks = [];
		};

		mediaRecorder.start(1000);
		isRecording = true;
		document.body.classList.add('recording');

		recordingStartTime = Date.now();
		updateRecordingTime();
		recordingTimerInterval = setInterval(updateRecordingTime, 1000);
	}

	function updateRecordingTime() {
		if (!recordingStartTime) return;
		const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
		const minutes = Math.floor(elapsed / 60);
		const seconds = elapsed % 60;
		recordingTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function stopRecording() {
		if (!isRecording || !mediaRecorder) return;

		const sceneName = scenes[currentSceneIndex].name;
		window.posthog?.capture('stop_recording', { scene: sceneName });

		mediaRecorder.stop();
		isRecording = false;
		isRecordLocked = false;
		document.body.classList.remove('recording', 'record-locked');
		recordLockEl.classList.remove('lock-hover');
		mediaRecorder = null;

		clearInterval(recordingTimerInterval);
		recordingTimerInterval = null;
		recordingStartTime = null;
		recordingTimeEl.textContent = '0:00';
	}

	function stopWebcamStream() {
		if (videoInput.srcObject) {
			videoInput.srcObject.getTracks().forEach(track => track.stop());
		}
	}

	async function flipCamera() {
		if (imageInput) return;
		if (videoInput && videoInput.src && !videoInput.srcObject) return;

		if (!hasBothFacingModes) return await cycleCamera();

		removeVideoInput();
		const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
		currentCameraIndex[newFacingMode] = 0;
		currentDeviceId = null;
		try {
			videoInput = await getCameraStream(newFacingMode);
			document.body.appendChild(videoInput); // HACK: Desktop Safari won't update the shader otherwise.
			shader.updateTextures({ u_inputStream: videoInput });
			currentFacingMode = newFacingMode;
			document.body.classList.toggle('flipped', newFacingMode === 'user');
			await updateCameraList();
			if (videoInput.srcObject) {
				const track = videoInput.srcObject.getVideoTracks()[0];
				if (track) {
					currentDeviceId = track.getSettings().deviceId;
					const cameras = camerasByFacingMode[currentFacingMode];
					const index = cameras.findIndex(c => c.deviceId === currentDeviceId);
					if (index !== -1) {
						currentCameraIndex[currentFacingMode] = index;
					}
				}
			}
		} catch (error) {
			console.error('Failed to switch camera:', error);
		}
	}

	async function cycleCamera() {
		if (imageInput) return;
		if (videoInput && videoInput.src && !videoInput.srcObject) return;

		await updateCameraList();
		const cameras = camerasByFacingMode[currentFacingMode];
		if (cameras.length <= 1) return;

		currentCameraIndex[currentFacingMode] = (currentCameraIndex[currentFacingMode] + 1) % cameras.length;
		const nextCamera = cameras[currentCameraIndex[currentFacingMode]];

		try {
			removeVideoInput();
			videoInput = await getCameraStream(currentFacingMode, nextCamera.deviceId);
			currentDeviceId = nextCamera.deviceId;
			document.body.appendChild(videoInput); // HACK: Desktop Safari won't update the shader otherwise.
			shader.updateTextures({ u_inputStream: videoInput });
		} catch (error) {
			console.error('Failed to switch to next camera:', error);
			// Try falling back to facingMode-only constraint
			try {
				videoInput = await getCameraStream(currentFacingMode);
				document.body.appendChild(videoInput);
				shader.updateTextures({ u_inputStream: videoInput });
			} catch (fallbackError) {
				console.error('Failed to fallback to facingMode camera:', fallbackError);
			}
		}
	}
	let shutterPressStart = null;
	let holdTimeout = null;
	let didStartRecording = false;

	function isOverLockIcon(clientX, clientY) {
		const lockRect = recordLockEl.getBoundingClientRect();
		return (
			clientX >= lockRect.left &&
			clientX <= lockRect.right &&
			clientY >= lockRect.top &&
			clientY <= lockRect.bottom
		);
	}

	function handleShutterDown(e) {
		e.preventDefault();
		if (isSettingsOpen) return;

		if (isRecordLocked) {
			stopRecording();
			return;
		}

		shutterPressStart = Date.now();
		didStartRecording = false;

		holdTimeout = setTimeout(() => {
			didStartRecording = true;
			startRecording();
		}, HOLD_THRESHOLD_MS);
	}

	function handleShutterMove(e) {
		if (!isRecording || isRecordLocked) return;

		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const clientY = e.touches ? e.touches[0].clientY : e.clientY;

		if (isOverLockIcon(clientX, clientY)) {
			recordLockEl.classList.add('lock-hover');
		} else {
			recordLockEl.classList.remove('lock-hover');
		}
	}

	function handleShutterUp(e) {
		e.preventDefault();
		if (isSettingsOpen) return;
		if (isRecordLocked) return;

		clearTimeout(holdTimeout);

		if (isRecording) {
			const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
			const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

			if (isOverLockIcon(clientX, clientY)) {
				isRecordLocked = true;
				document.body.classList.add('record-locked');
				recordLockEl.classList.remove('lock-hover');
			} else {
				stopRecording();
			}
		} else if (!didStartRecording && shutterPressStart) {
			exportHighRes();
		}

		shutterPressStart = null;
		didStartRecording = false;
	}

	function handleShutterLeave(e) {
		if (isRecordLocked) return;
		if (isRecording) return;

		clearTimeout(holdTimeout);
		shutterPressStart = null;
		didStartRecording = false;
	}

	shutterButton.addEventListener('mousedown', handleShutterDown);
	shutterButton.addEventListener('mouseup', handleShutterUp);
	shutterButton.addEventListener('mousemove', handleShutterMove);
	shutterButton.addEventListener('mouseleave', handleShutterLeave);
	shutterButton.addEventListener('touchstart', handleShutterDown, { passive: false });
	shutterButton.addEventListener('touchend', handleShutterUp, { passive: false });
	shutterButton.addEventListener('touchmove', handleShutterMove, { passive: false });
	shutterButton.addEventListener('touchcancel', handleShutterLeave);

	document.addEventListener('mousemove', e => {
		if (!isRecording || isRecordLocked) return;
		handleShutterMove(e);
	});
	document.addEventListener(
		'touchmove',
		e => {
			if (!isRecording || isRecordLocked) return;
			handleShutterMove(e);
		},
		{ passive: false }
	);
	document.addEventListener('mouseup', e => {
		if (!isRecording || isRecordLocked || !shutterPressStart) return;
		handleShutterUp(e);
	});
	document.addEventListener(
		'touchend',
		e => {
			if (!isRecording || isRecordLocked || !shutterPressStart) return;
			handleShutterUp(e);
		},
		{ passive: false }
	);

	openMenuButton.addEventListener('click', toggleSettings);
	flipCameraButton.addEventListener('click', flipCamera);
	goButton.addEventListener('click', toggleSettings);
	scenePrev.addEventListener('click', () => {
		switchToScene((currentSceneIndex - 1 + scenes.length) % scenes.length);
	});
	sceneNext.addEventListener('click', () => {
		switchToScene((currentSceneIndex + 1) % scenes.length);
	});

	function toggleSettings() {
		isSettingsOpen = !isSettingsOpen;
		document.body.classList.toggle('settings-open', isSettingsOpen);
	}
	function toggleControls() {
		isControlsHidden = !isControlsHidden;
		document.body.classList.toggle('controls-hidden', isControlsHidden);
	}

	let cleanupScene;
	function switchToScene(index, skipHashUpdate) {
		currentSceneIndex = index;
		const scene = scenes[currentSceneIndex];
		const loadingSceneIndex = currentSceneIndex;
		cleanupScene?.();
		settingsEl.classList.add('scene-loading', 'populated');
		titleEl.textContent = scene.name;
		titleEl.setAttribute('data-text', scene.name);

		let sceneReadyPromise;
		function wrappedSetShader(newShader) {
			shader = newShader;
			cleanupScene = () => {
				settingsEl.classList.remove('scene-loading');
				shader?.destroy();
			};
			const events = scene.pluginReadyEvents ?? [];
			if (events.length === 0) {
				sceneReadyPromise = Promise.resolve();
			} else {
				let count = 0;
				sceneReadyPromise = new Promise(resolve => {
					const check = () => {
						count++;
						if (count >= events.length) resolve();
					};
					for (const e of events) shader.on(e, check);
				});
			}
		}

		scene.initialize(wrappedSetShader, canvas, gl);
		const userControls = { ...defaultUserControls, ...(scene.controlValues ?? {}) };
		const textureOptions = scene.history ? { history: scene.history } : undefined;
		shader.initializeTexture('u_inputStream', videoInput, textureOptions);
		play = function play() {
			shader.play(() => {
				shader.updateTextures({ u_inputStream: videoInput });
			});
		};
		play();

		sceneReadyPromise.then(() => {
			if (loadingSceneIndex !== currentSceneIndex) return;
			settingsEl.classList.remove('scene-loading');
			const cleanupControls = attachControls(scene, getUpdates => {
				if (isSettingsOpen) return;
				const updates = getUpdates(userControls);
				Object.assign(userControls, updates);
				scene.onUpdate?.(userControls, shader);
			});
			cleanupScene = () => {
				cleanupControls();
				shader.destroy();
			};
		});

		if (!skipHashUpdate) updateUrlHash(scenes[currentSceneIndex]);
	}

	document.addEventListener('keydown', e => {
		if (e.repeat) return;
		switch (e.key) {
			case 'Escape':
				toggleSettings();
				break;
			case 'h':
			case 'H':
				if (!isSettingsOpen) {
					toggleControls();
				}
				break;
			case 'c':
			case 'C':
				if (!isSettingsOpen) {
					cycleCamera();
				}
				break;
			case 'a':
			case 'A':
				switchToScene((currentSceneIndex - 1 + scenes.length) % scenes.length);
				break;
			case 'd':
			case 'D':
				switchToScene((currentSceneIndex + 1) % scenes.length);
				break;
			case 'ArrowRight':
				if (isSettingsOpen) {
					switchToScene((currentSceneIndex + 1) % scenes.length);
				}
				break;
			case 'ArrowLeft':
				if (isSettingsOpen) {
					switchToScene((currentSceneIndex - 1 + scenes.length) % scenes.length);
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
					if (!isSettingsOpen) flipCamera();
					break;
				case 3:
					if (!isSettingsOpen) cycleCamera();
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

	switchToScene(currentSceneIndex, true);
}

document.addEventListener('DOMContentLoaded', main);
