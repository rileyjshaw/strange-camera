import handleTouch from './handleTouch';
import attachControls from './controls';
import saveVideo from './saveVideo';
import scenes, { sceneHashToIndex } from './scenes';
import { save } from 'shaderpad/util';
import {
	BufferTarget,
	CanvasSource,
	MediaStreamAudioTrackSource,
	Mp4OutputFormat,
	Output,
	WebMOutputFormat,
	getFirstEncodableAudioCodec,
	getFirstEncodableVideoCodec,
} from 'mediabunny';

function updateUrlHash(scene) {
	window.location.hash = scene.hash;
}

const urlHash = window.location.hash.slice(1);
let currentSceneIndex = sceneHashToIndex.get(urlHash) ?? Math.floor(Math.random() * scenes.length);

const TARGET_CAMERA_WIDTH = 1280;
const TARGET_CAMERA_HEIGHT = 720;
const MAX_CANVAS_DIMENSION = 1280;
const HOLD_THRESHOLD_MS = 300;
const RECORDING_FRAME_RATE = 30;
const RECORDING_VIDEO_BITRATE = 2_500_000;
const RECORDING_AUDIO_BITRATE = 128_000;
const DEFAULT_CAMERA_CONSTRAINTS = {
	width: { ideal: TARGET_CAMERA_WIDTH },
	height: { ideal: TARGET_CAMERA_HEIGHT },
};

function getMaxDimensionSize(width, height, maxDimension) {
	const safeWidth = Math.max(1, width);
	const safeHeight = Math.max(1, height);
	const scale = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight));
	return {
		width: Math.max(1, Math.round(safeWidth * scale)),
		height: Math.max(1, Math.round(safeHeight * scale)),
	};
}

let hasCameraPermission = false;

let sessionAudioTrack = null;
let aacEncoderRegistrationPromise = null;

function checkMicHealth() {
	if (!sessionAudioTrack) return false;
	if (sessionAudioTrack.readyState !== 'live') return false;
	if (!sessionAudioTrack.enabled) return false;
	return true;
}

async function reacquireMic() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const track = stream.getAudioTracks()[0];
		if (track) {
			if (sessionAudioTrack) {
				sessionAudioTrack.stop();
			}
			sessionAudioTrack = track;
			return true;
		}
	} catch {
		// ignore
	}
	return false;
}

async function getCameraStream(existingStream = null, facingMode = 'user', deviceId = null) {
	const video = document.createElement('video');
	video.autoplay = video.playsInline = video.muted = true;

	try {
		let stream;
		if (existingStream && existingStream.getVideoTracks().length > 0) {
			stream = existingStream;
		} else {
			const constraints = {
				video: deviceId
					? { deviceId: { exact: deviceId }, ...DEFAULT_CAMERA_CONSTRAINTS }
					: { facingMode, ...DEFAULT_CAMERA_CONSTRAINTS },
			};
			stream = await navigator.mediaDevices.getUserMedia(constraints);
		}
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

async function main(initialVideoStream = null) {
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
	let videoInput = await getCameraStream(initialVideoStream, currentFacingMode);
	let imageInput = null;
	let currentVideoUrl = null;

	const audioProblemIndicator = document.getElementById('audio-problem-indicator');
	const recordLockEl = document.getElementById('record-lock');

	let isRecording = false;
	let isRecordLocked = false;
	let recordingOutput = null;
	let recordingVideoSource = null;
	let recordingAudioSource = null;
	let recordingStartPromise = null;
	let recordingStartTime = null;
	let recordingTimerInterval = null;
	let cleanupRecordingFrameCapture = null;
	let recordingFrameState = null;
	const recordingTimeEl = document.querySelector('.recording-time');

	let play;

	const app = document.getElementById('app');
	const settingsEl = document.getElementById('settings');
	const titleEl = document.getElementById('title');
	const canvas = document.querySelector('canvas');
	const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });

	function getSourceDimensions(source) {
		if (!source) return null;
		const width = source.videoWidth || source.naturalWidth || source.width || 0;
		const height = source.videoHeight || source.naturalHeight || source.height || 0;
		if (!width || !height) return null;
		return { width, height };
	}

	function getCanvasMaxDimension(scene = scenes[currentSceneIndex]) {
		return Math.min(MAX_CANVAS_DIMENSION, scene?.maxTextureSize ?? MAX_CANVAS_DIMENSION);
	}

	function getRenderCanvasSizeForSource(source, scene = scenes[currentSceneIndex]) {
		const dimensions = getSourceDimensions(source);
		if (!dimensions) return null;
		return getMaxDimensionSize(dimensions.width, dimensions.height, getCanvasMaxDimension(scene));
	}

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
				syncRenderCanvasToSource(image);
				play = function play() {
					shader.play(() => {
						shader.updateTextures({ u_inputStream: image });
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
			syncRenderCanvasToSource(videoInput);
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

	async function exportHighRes(e) {
		const sceneName = scenes[currentSceneIndex].name;
		window.posthog?.capture('take_photo', { scene: sceneName });
		shader.pause();
		await save(shader, `Strange Camera - ${sceneName}`, window.location.href, {
			preventShare: e.pointerType === 'mouse',
		});
		play();
	}

	function setRenderCanvasSize(width, height, { notifyShader = true } = {}) {
		if (canvas.width === width && canvas.height === height) return;
		canvas.width = width;
		canvas.height = height;
		gl.viewport(0, 0, width, height);
		if (notifyShader) shader?.resize?.(width, height);
	}

	function syncRenderCanvasToSource(source, { notifyShader = true, scene = scenes[currentSceneIndex] } = {}) {
		const nextSize = getRenderCanvasSizeForSource(source, scene);
		if (!nextSize) return;
		setRenderCanvasSize(nextSize.width, nextSize.height, { notifyShader });
	}

	function resetRecordingState() {
		isRecording = false;
		isRecordLocked = false;
		isShutterPressed = false;
		document.body.classList.remove('recording', 'record-locked');
		recordLockEl.classList.remove('lock-hover');
		clearActiveShutterPointer();
		recordingOutput = null;
		recordingVideoSource = null;
		recordingAudioSource = null;
		cleanupRecordingFrameCapture = null;
		recordingFrameState = null;
		recordingStartPromise = null;
		audioProblemIndicator.style.display = 'none';

		clearInterval(recordingTimerInterval);
		recordingTimerInterval = null;
		recordingStartTime = null;
		recordingTimeEl.textContent = '0:00';
	}

	async function stopRecordingFrameCapture() {
		const frameState = recordingFrameState;
		if (!frameState) return;

		if (!frameState.stopped) {
			frameState.stopped = true;
			cleanupRecordingFrameCapture?.();
			cleanupRecordingFrameCapture = null;

			if (recordingVideoSource) {
				try {
					await enqueueRecordingFrame(true);
				} catch {
					// Finalize handles surfaced errors.
				}
			}
		}

		await frameState.pendingFramePromise.catch(() => {});
	}

	function getAudioEncodingProbeConfig() {
		const settings = sessionAudioTrack?.getSettings?.() ?? {};
		return {
			numberOfChannels: settings.channelCount || 2,
			sampleRate: settings.sampleRate || 48_000,
			bitrate: RECORDING_AUDIO_BITRATE,
		};
	}

	async function ensureAacEncoderRegistered() {
		if (!aacEncoderRegistrationPromise) {
			aacEncoderRegistrationPromise = import('@mediabunny/aac-encoder').then(({ registerAacEncoder }) =>
				registerAacEncoder()
			);
		}
		await aacEncoderRegistrationPromise;
	}

	async function getRecordingProfile(hasAudio) {
		const videoOptions = {
			width: canvas.width,
			height: canvas.height,
			bitrate: RECORDING_VIDEO_BITRATE,
		};
		const audioOptions = getAudioEncodingProbeConfig();

		const mp4VideoCodec = await getFirstEncodableVideoCodec(['avc', 'hevc'], videoOptions);
		if (mp4VideoCodec) {
			let mp4AudioCodec = null;
			if (hasAudio) {
				mp4AudioCodec = await getFirstEncodableAudioCodec(['aac'], audioOptions);
				if (!mp4AudioCodec) {
					await ensureAacEncoderRegistered();
					mp4AudioCodec = await getFirstEncodableAudioCodec(['aac'], audioOptions);
				}
			}

			if (!hasAudio || mp4AudioCodec) {
				return {
					format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
					extension: 'mp4',
					videoCodec: mp4VideoCodec,
					audioCodec: mp4AudioCodec,
				};
			}
		}

		const webmVideoCodec = await getFirstEncodableVideoCodec(['vp09', 'vp8'], videoOptions);
		const webmAudioCodec = hasAudio ? await getFirstEncodableAudioCodec(['opus'], audioOptions) : null;
		if (!webmVideoCodec || (hasAudio && !webmAudioCodec)) {
			throw new Error('No compatible Mediabunny recording profile is available in this browser.');
		}

		return {
			format: new WebMOutputFormat(),
			extension: 'webm',
			videoCodec: webmVideoCodec,
			audioCodec: webmAudioCodec,
		};
	}

	async function createRecordingOutput(audioTrack = null) {
		const profile = await getRecordingProfile(!!audioTrack);
		const output = new Output({
			format: profile.format,
			target: new BufferTarget(),
		});

		const videoSource = new CanvasSource(canvas, {
			codec: profile.videoCodec,
			bitrate: RECORDING_VIDEO_BITRATE,
			latencyMode: 'realtime',
			hardwareAcceleration: 'prefer-hardware',
		});
		output.addVideoTrack(videoSource, { frameRate: RECORDING_FRAME_RATE });

		let audioSource = null;
		if (audioTrack && profile.audioCodec) {
			audioSource = new MediaStreamAudioTrackSource(audioTrack, {
				codec: profile.audioCodec,
				bitrate: RECORDING_AUDIO_BITRATE,
			});
			audioSource.errorPromise.catch(error => {
				console.error('Mediabunny audio source error:', error);
			});
			output.addAudioTrack(audioSource);
		}

		await output.start();
		return { output, videoSource, audioSource, extension: profile.extension };
	}

	function startRecordingFrameCapture() {
		const frameState = {
			startTimeMs: performance.now(),
			lastQueuedTimestamp: null,
			pendingFramePromise: Promise.resolve(),
			frameInFlight: false,
			frameQueuedWhileBusy: false,
			stopped: false,
			error: null,
		};
		recordingFrameState = frameState;

		const handleAfterDraw = () => {
			void enqueueRecordingFrame();
		};

		shader.on('afterDraw', handleAfterDraw);
		cleanupRecordingFrameCapture = () => {
			shader.off('afterDraw', handleAfterDraw);
		};

		void enqueueRecordingFrame(true);
	}

	function enqueueRecordingFrame(force = false) {
		if (!recordingVideoSource || !recordingFrameState || recordingFrameState.stopped) {
			return recordingFrameState?.pendingFramePromise ?? Promise.resolve();
		}

		const frameState = recordingFrameState;
		const timestamp = Math.max(0, (performance.now() - frameState.startTimeMs) / 1000);
		const minFrameInterval = 1 / RECORDING_FRAME_RATE;
		if (
			!force &&
			frameState.lastQueuedTimestamp !== null &&
			timestamp - frameState.lastQueuedTimestamp < minFrameInterval * 0.9
		) {
			return frameState.pendingFramePromise;
		}

		if (frameState.frameInFlight) {
			frameState.frameQueuedWhileBusy = true;
			return frameState.pendingFramePromise;
		}

		frameState.frameInFlight = true;
		frameState.lastQueuedTimestamp = timestamp;
		frameState.pendingFramePromise = recordingVideoSource
			.add(timestamp, minFrameInterval)
			.catch(error => {
				frameState.error = error;
				console.error('Mediabunny video source error:', error);
				throw error;
			})
			.finally(() => {
				frameState.frameInFlight = false;
				if (frameState.frameQueuedWhileBusy && !frameState.stopped) {
					frameState.frameQueuedWhileBusy = false;
					void enqueueRecordingFrame(true);
				}
			});

		return frameState.pendingFramePromise;
	}

	async function startRecording() {
		if (isRecording) return;

		isRecording = true;
		document.body.classList.add('recording');

		let isMicHealthy = checkMicHealth();
		if (!isMicHealthy) {
			isMicHealthy = await reacquireMic();
		}
		audioProblemIndicator.style.display = isMicHealthy ? 'none' : 'flex';

		const sceneName = scenes[currentSceneIndex].name;
		window.posthog?.capture('start_recording', { scene: sceneName });

		try {
			const recording = await createRecordingOutput(checkMicHealth() ? sessionAudioTrack : null);
			recordingOutput = recording.output;
			recordingVideoSource = recording.videoSource;
			recordingAudioSource = recording.audioSource;
			startRecordingFrameCapture();

			recordingStartTime = Date.now();
			updateRecordingTime();
			recordingTimerInterval = setInterval(updateRecordingTime, 250);
		} catch (error) {
			await stopRecordingFrameCapture();
			await recordingOutput?.cancel?.().catch(() => {});
			console.error('Failed to start recording:', error);
			resetRecordingState();
		}
	}

	function updateRecordingTime() {
		if (!recordingStartTime) return;
		const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
		const minutes = Math.floor(elapsed / 60);
		const seconds = elapsed % 60;
		recordingTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	async function stopRecording(e) {
		if (!isRecording || !recordingOutput) return;

		const sceneName = scenes[currentSceneIndex].name;
		window.posthog?.capture('stop_recording', { scene: sceneName });
		const output = recordingOutput;
		let recordingFile = null;

		try {
			await stopRecordingFrameCapture();
			if (recordingFrameState?.error) {
				throw recordingFrameState.error;
			}

			await output.finalize();
			const buffer = output.target.buffer;
			if (buffer) {
				recordingFile = {
					type: output.format.mimeType,
					filename: `Strange Camera - ${sceneName}.${output.format.fileExtension.slice(1)}`,
					blob: new Blob([buffer], { type: output.format.mimeType }),
				};
			}
		} catch (error) {
			console.error('Failed to finalize recording:', error);
			await stopRecordingFrameCapture();
			await output.cancel().catch(() => {});
			resetRecordingState();
			return;
		}

		resetRecordingState();

		if (recordingFile) {
			try {
				await saveVideo(recordingFile.blob, recordingFile.type, recordingFile.filename, window.location.href, {
					preventShare: e.pointerType === 'mouse',
				});
			} catch (error) {
				console.error('Failed to save recording:', error);
			}
		}
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
			videoInput = await getCameraStream(null, newFacingMode);
			document.body.appendChild(videoInput); // HACK: Desktop Safari won't update the shader otherwise.
			syncRenderCanvasToSource(videoInput);
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
			videoInput = await getCameraStream(null, currentFacingMode, nextCamera.deviceId);
			currentDeviceId = nextCamera.deviceId;
			document.body.appendChild(videoInput); // HACK: Desktop Safari won't update the shader otherwise.
			syncRenderCanvasToSource(videoInput);
			shader.updateTextures({ u_inputStream: videoInput });
		} catch (error) {
			console.error('Failed to switch to next camera:', error);
			// Try falling back to facingMode-only constraint
			try {
				videoInput = await getCameraStream(null, currentFacingMode);
				document.body.appendChild(videoInput);
				syncRenderCanvasToSource(videoInput);
				shader.updateTextures({ u_inputStream: videoInput });
			} catch (fallbackError) {
				console.error('Failed to fallback to facingMode camera:', fallbackError);
			}
		}
	}
	let holdTimeout = null;
	let isShutterPressed = false;
	let recordingStartedFromCurrentPress = false;
	let activeShutterPointerId = null;

	function clearHoldTimeout() {
		clearTimeout(holdTimeout);
		holdTimeout = null;
	}

	function clearActiveShutterPointer() {
		if (activeShutterPointerId !== null && shutterButton.hasPointerCapture?.(activeShutterPointerId)) {
			shutterButton.releasePointerCapture(activeShutterPointerId);
		}
		activeShutterPointerId = null;
	}

	function isOverLockIcon(clientX, clientY) {
		const lockRect = recordLockEl.getBoundingClientRect();
		return (
			clientX >= lockRect.left &&
			clientX <= lockRect.right &&
			clientY >= lockRect.top &&
			clientY <= lockRect.bottom
		);
	}

	function updateRecordLockHover(e) {
		if (!isRecording || isRecordLocked) {
			recordLockEl.classList.remove('lock-hover');
			return false;
		}

		const isHoveringLock = isOverLockIcon(e.clientX, e.clientY);
		recordLockEl.classList.toggle('lock-hover', isHoveringLock);
		return isHoveringLock;
	}

	function handleShutterDown(e) {
		e.preventDefault();
		if (isSettingsOpen) return;

		if (isRecordLocked) {
			void stopRecording(e);
			return;
		}

		if (isRecording || activeShutterPointerId !== null) return;

		isShutterPressed = true;
		recordingStartedFromCurrentPress = false;
		activeShutterPointerId = e.pointerId;
		shutterButton.setPointerCapture?.(e.pointerId);

		holdTimeout = setTimeout(() => {
			recordingStartedFromCurrentPress = true;
			recordingStartPromise = startRecording().finally(() => {
				recordingStartPromise = null;
			});
		}, HOLD_THRESHOLD_MS);
	}

	async function handleShutterUp(e) {
		if (e.pointerId !== activeShutterPointerId) return;
		e.preventDefault();
		isShutterPressed = false;
		clearActiveShutterPointer();
		clearHoldTimeout();
		if (isSettingsOpen) return;

		if (recordingStartedFromCurrentPress) {
			recordingStartedFromCurrentPress = false;
			await recordingStartPromise;
			if (isRecording) {
				if (updateRecordLockHover(e)) {
					isRecordLocked = true;
					document.body.classList.add('record-locked');
					recordLockEl.classList.remove('lock-hover');
					return;
				}
				await stopRecording(e);
			}
			return;
		}

		if (isRecording) {
			if (updateRecordLockHover(e)) {
				isRecordLocked = true;
				document.body.classList.add('record-locked');
				recordLockEl.classList.remove('lock-hover');
				return;
			}
			await stopRecording(e);
		} else {
			exportHighRes(e);
		}
	}

	function handleShutterMove(e) {
		if (e.pointerId !== activeShutterPointerId) return;
		updateRecordLockHover(e);
	}

	function handleShutterLeave(e) {
		if (e.pointerId !== activeShutterPointerId) return;
		isShutterPressed = false;
		clearActiveShutterPointer();
		recordLockEl.classList.remove('lock-hover');
		if (!isRecording) {
			recordingStartedFromCurrentPress = false;
			clearHoldTimeout();
		}
	}

	shutterButton.addEventListener('pointerdown', handleShutterDown);
	document.addEventListener('pointermove', handleShutterMove);
	document.addEventListener('pointerup', e => {
		void handleShutterUp(e);
	});
	document.addEventListener('pointercancel', handleShutterLeave);

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

		const currentInput = imageInput || videoInput;
		syncRenderCanvasToSource(currentInput, { notifyShader: false, scene });
		scene.initialize(wrappedSetShader, canvas, gl);
		const userControls = { ...defaultUserControls, ...(scene.controlValues ?? {}) };
		const textureOptions = scene.history ? { history: scene.history } : undefined;

		shader.initializeTexture('u_inputStream', currentInput, textureOptions);
		play = function play() {
			shader.play(() => {
				const source = imageInput || videoInput;
				shader.updateTextures({ u_inputStream: source });
			});
		};
		play();

		sceneReadyPromise.then(() => {
			if (loadingSceneIndex !== currentSceneIndex) return;
			settingsEl.classList.remove('scene-loading');
			const cleanupControls = attachControls(scene, getUpdates => {
				if (isSettingsOpen || isShutterPressed) return;
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

document.addEventListener('DOMContentLoaded', () => {
	const splash = document.getElementById('splash');
	const splashStart = document.getElementById('splash-start');

	splashStart.addEventListener('click', async () => {
		let stream = null;
		const videoConstraints = { facingMode: 'user', ...DEFAULT_CAMERA_CONSTRAINTS };
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: videoConstraints,
				audio: true,
			});
		} catch {
			try {
				stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
			} catch (videoErr) {
				console.error('Camera permission denied:', videoErr);
				const splashTitle = splash.querySelector('.splash-title');
				const splashTitleCamera = splashTitle.querySelector('.camera');
				const splashMessage = splash.querySelector('.splash-message');
				splashTitleCamera.classList.add('flicker');
				splashMessage.textContent =
					'There’s an error because we couldn’t get camera access. Camera permission is needed to take photos in this app. Please reload this page and grant access, or update the settings for your device or browser. Each photo / video remains 100% on your device and isn’t sent to a server.';
				// const extraMessage = document.createElement('p');
				// extraMessage.className = 'splash-message';
				// extraMessage.textContent =
				// 	'We took a long time writing this error message so every line has the same number of characters. Very difficult. Anyway, if you grant access to your camera and mic next time you can start actually using the fun parts of this site. Good luck. We believe in you. See you again soon!';
				// splashMessage.after(extraMessage);

				splashStart.style.display = 'none';
			}
		}

		const audioTracks = stream.getAudioTracks();
		if (audioTracks.length > 0) {
			sessionAudioTrack = audioTracks[0];
		}

		const videoTracks = stream.getVideoTracks();
		const initialVideoStream = videoTracks.length > 0 ? new MediaStream(videoTracks) : null;

		document.body.classList.add('splash-dismissed');
		main(initialVideoStream);
	});
});
