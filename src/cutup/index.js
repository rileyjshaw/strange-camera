import ShaderPad from 'shaderpad';
import save from 'shaderpad/plugins/save';
import handleTouch from '../handleTouch';
import fragmentShaderSrc from './cutup.glsl';

const MIN_N_STRIPS = 2;
const MAX_N_STRIPS = 1920;
const MIN_N_SHUFFLES = 1;
const MAX_N_SHUFFLES = 10;
const MAX_EXPORT_DIMENSION = 4096;

async function getWebcamStream(facingMode = 'user') {
	const video = document.createElement('video');
	video.autoplay = video.playsInline = video.muted = true;

	try {
		const constraints = {
			video: {
				facingMode,
				width: 4096,
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

function isPowerOfTwo(n) {
	return (n & (n - 1)) === 0;
}

function getPowerOfTwoExponent(n) {
	return 31 - Math.clz32(n);
}

const getStepSize = (() => {
	const stepSizes = new Map();
	const cycleLengths = new Map();
	return function getStepSize(nShuffles, nStrips) {
		nShuffles = Math.floor(nShuffles);
		if (cycleLengths.has(nStrips)) {
			nShuffles = nShuffles % cycleLengths.get(nStrips);
		}
		if (nShuffles === 0 || nStrips < 2) return 1; // Normal image.
		if (nShuffles === 1) return nStrips - 1;
		if (nShuffles === 2) return Math.floor(nStrips / 2);
		const key = `${nShuffles},${nStrips}`;
		if (stepSizes.has(key)) return stepSizes.get(key);

		let fromArray = new Uint16Array(nStrips);
		let destArray = new Uint16Array(nStrips);
		for (let i = 0; i < nStrips; ++i) {
			destArray[i] = i;
		}
		for (let shuffleCount = 1; shuffleCount <= nShuffles; ++shuffleCount) {
			[fromArray, destArray] = [destArray, fromArray]; // Swap arrays.
			for (let j = 0, _len = nStrips / 2, _cutoff = Math.floor(_len); j < _len; ++j) {
				const destIdx = j * 2;
				destArray[destIdx] = fromArray[j];
				if (j < _cutoff) destArray[destIdx + 1] = fromArray.at(-1 - j);
			}

			// Memoize intermediate steps.
			const step = destArray[1];
			if (shuffleCount > 2) {
				const memoKey = `${shuffleCount},${nStrips}`;
				if (!stepSizes.has(memoKey)) stepSizes.set(memoKey, step);
			}

			// If destArray[1] is a power of two, we can short-circuit the rest of the shuffles, since the next steps
			// are just descending powers of two. It loops once it hits 1, so we can just fill the stepSizes and
			// cycleLengths memos for this nShuffles then call getStepSize again to hit the memoized early exit.
			if (isPowerOfTwo(step)) {
				let exponent = getPowerOfTwoExponent(step);
				cycleLengths.set(nStrips, shuffleCount + exponent);
				for (let i = 1; i < exponent; ++i) {
					stepSizes.set(`${shuffleCount + i},${nStrips}`, 1 << (exponent - i));
				}
				return getStepSize(nShuffles, nStrips); // It’s memoized.
			}
		}
		return destArray[1];
	};
})();

async function main() {
	// State.
	let currentFacingMode = 'user'; // Selfie camera.

	let videoInput = await getWebcamStream(currentFacingMode);
	let imageInput = null;

	let nStrips = 32;
	let nShuffles = MIN_N_SHUFFLES;
	let stepSize = getStepSize(nShuffles, nStrips);

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

	const displayShader = new ShaderPad(fragmentShaderSrc);
	const exportCanvas = document.createElement('canvas');
	exportCanvas.classList.add('export');
	const exportShader = new ShaderPad(fragmentShaderSrc, { canvas: exportCanvas, plugins: [save()] });
	[displayShader, exportShader].forEach(shader => {
		shader.initializeUniform('u_nShuffles', 'int', nShuffles);
		shader.initializeUniform('u_nStrips', 'float', nStrips);
		shader.initializeUniform('u_stepSize', 'float', stepSize);
		shader.initializeTexture('u_inputStream', videoInput);
	});

	function exportHighRes() {
		displayShader.pause();
		const scaleFactor = Math.pow(2, Math.floor(nShuffles) + 1);
		let exportWidth, exportHeight;

		if (imageInput) {
			exportWidth = imageInput.naturalWidth * scaleFactor;
			exportHeight = imageInput.naturalHeight * scaleFactor;
		} else {
			exportWidth = videoInput.videoWidth * scaleFactor;
			exportHeight = videoInput.videoHeight * scaleFactor;
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
		exportCanvas.width = exportWidth;
		exportCanvas.height = exportHeight;

		exportShader.updateUniforms({ u_nShuffles: nShuffles, u_nStrips: nStrips, u_stepSize: stepSize });
		exportShader.updateTextures({ u_inputStream: imageInput ?? videoInput });
		document.body.appendChild(exportCanvas);
		setTimeout(async () => {
			exportShader.step(0);
			await exportShader.save('odd-camera');
			document.body.removeChild(exportCanvas);
			play();
		}, 8);
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
		let uniformsToUpdate = null;
		switch (e.key) {
			case 'ArrowUp':
				nStrips = Math.min(MAX_N_STRIPS, nStrips + 1);
				uniformsToUpdate = { u_nStrips: nStrips };
				break;
			case 'ArrowDown':
				nStrips = Math.max(MIN_N_STRIPS, nStrips - 1);
				uniformsToUpdate = { u_nStrips: nStrips };
				break;
			case 'ArrowRight':
				nShuffles = Math.min(MAX_N_SHUFFLES, nShuffles + 1);
				uniformsToUpdate = { u_nShuffles: nShuffles };
				break;
			case 'ArrowLeft':
				nShuffles = Math.max(MIN_N_SHUFFLES, nShuffles - 1);
				uniformsToUpdate = { u_nShuffles: nShuffles };
				break;
			case 's':
				exportHighRes();
				break;
		}
		if (uniformsToUpdate) {
			uniformsToUpdate.u_stepSize = stepSize = getStepSize(nShuffles, nStrips);
			displayShader.updateUniforms(uniformsToUpdate);
		}
	});

	shutter.addEventListener('click', () => {
		exportHighRes();
	});

	handleTouch(document.body, (direction, diff) => {
		if (diff > 16) lastTapTime = 0;
		let uniformsToUpdate = null;
		if (direction === 'x') {
			nShuffles = Math.max(MIN_N_SHUFFLES, Math.min(MAX_N_SHUFFLES, nShuffles + Math.sign(diff) / 8));
			uniformsToUpdate = { u_nShuffles: nShuffles };
		} else {
			nStrips = Math.max(MIN_N_STRIPS, Math.min(MAX_N_STRIPS, nStrips - Math.sign(diff)));
			uniformsToUpdate = { u_nStrips: nStrips };
		}
		if (uniformsToUpdate) {
			uniformsToUpdate.u_stepSize = stepSize = getStepSize(nShuffles, nStrips);
			displayShader.updateUniforms(uniformsToUpdate);
		}
	});

	// Double-tap to switch camera.
	let lastTapTime = 0;
	document.body.addEventListener('touchend', () => {
		const currentTime = Date.now();
		if (currentTime - lastTapTime < 300) {
			switchCamera();
		}
		lastTapTime = currentTime;
	});

	let play = function play() {
		displayShader.play(() => {
			displayShader.updateTextures({ u_inputStream: videoInput });
		});
	};
	play();
}

document.addEventListener('DOMContentLoaded', main);
