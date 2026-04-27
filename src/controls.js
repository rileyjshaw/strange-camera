import handleTouch from './handleTouch';
import { autoTextSize } from './autoTextSize';

const SLIDER_FEEDBACK_HIDE_DELAY_MS = 900;
const SLIDER_FEEDBACK_MAX_FONT_SIZE_PX = 42;

function generatePrecisionDefaults(controls) {
	return Object.fromEntries([
		...(controls[0]?.map((_, i) => [`x${i + 1}`, 0.003]) ?? []),
		...(controls[1]?.map((_, i) => [`y${i + 1}`, 0.001]) ?? []),
	]);
}

let width = 0;
let height = 0;
function updateDimensions() {
	width = window.visualViewport.width;
	height = window.visualViewport.height;
}
updateDimensions();
window.visualViewport.addEventListener('resize', updateDimensions);

const settingsContainer = document.getElementById('settings');
const titleEl = document.getElementById('title');
const controlsXContainer = document.getElementById('controls-x');
const controlsYContainer = document.getElementById('controls-y');
const controlsListMove = document.getElementById('controls-list-move');
const sliderFeedbackEl = document.getElementById('slider-feedback');
const sliderFeedbackTextEl = document.getElementById('slider-feedback-text');

function getControlName(scene, key) {
	const controlIndex = Number.parseInt(key.slice(1), 10) - 1;
	if (!Number.isInteger(controlIndex) || controlIndex < 0) return null;
	return scene.controls[key[0] === 'y' ? 1 : 0]?.[controlIndex] ?? null;
}

function createSliderFeedback(scene) {
	if (!sliderFeedbackEl || !sliderFeedbackTextEl) {
		return {
			show() {},
			destroy() {},
		};
	}

	const updateTextSize = autoTextSize({
		innerEl: sliderFeedbackTextEl,
		containerEl: sliderFeedbackEl,
		mode: 'oneline',
		maxFontSizePx: SLIDER_FEEDBACK_MAX_FONT_SIZE_PX,
	});
	let hideTimeout = null;

	function hide() {
		sliderFeedbackEl.classList.remove('active');
	}

	return {
		show(key, value) {
			const controlName = getControlName(scene, key);
			if (!controlName || document.body.classList.contains('settings-open')) return;

			sliderFeedbackTextEl.textContent = controlName;
			sliderFeedbackEl.style.setProperty('--slider-feedback-fill', `${value * 100}%`);
			sliderFeedbackEl.classList.add('active');
			updateTextSize();

			clearTimeout(hideTimeout);
			hideTimeout = setTimeout(hide, SLIDER_FEEDBACK_HIDE_DELAY_MS);
		},
		destroy() {
			clearTimeout(hideTimeout);
			hide();
			sliderFeedbackTextEl.textContent = '';
			updateTextSize.disconnect();
		},
	};
}

function attachControls(scene, handleMove) {
	const [xControlsLength, yControlsLength] = scene.controls.map(arr => arr.length);
	const controlModifiers = scene.controlModifiers ?? {};
	const sliderFeedback = createSliderFeedback(scene);

	titleEl.textContent = scene.name;
	titleEl.setAttribute('data-text', scene.name);
	scene.controls.forEach((controls, i) => {
		controls.forEach(controlName => {
			const div = document.createElement('div');
			const li = document.createElement('li');
			li.textContent = controlName;
			(i ? controlsYContainer : controlsXContainer).appendChild(div);
			controlsListMove.appendChild(li);
		});
	});

	const precisionDefaults = generatePrecisionDefaults(scene.controls);
	const precision = Object.fromEntries(
		Object.keys(precisionDefaults).map(key => [
			key,
			controlModifiers[key]?.precision ?? precisionDefaults[key],
		])
	);

	function computeValue(currentValues, key, diff) {
		const newValue = currentValues[key] + diff * precision[key];
		if (controlModifiers[key]?.loop) {
			return ((newValue % 1) + 1) % 1;
		}
		return Math.max(0, Math.min(1, newValue));
	}
	function getControlUpdate(currentValues, key, diff) {
		if (!getControlName(scene, key)) return {};
		const value = computeValue(currentValues, key, diff);
		sliderFeedback.show(key, value);
		return { [key]: value };
	}
	const touchCleanup = handleTouch(document.body, {
		onMove(direction, diff, nTouches, initialX, initialY) {
			if (nTouches > 1) return;
			handleMove(currentValues => {
				// IMPORTANT: “y” actually means “the longer axis”. If the viewport
				// is landscape, flip the direction.
				if (width > height) direction = direction === 'x' ? 'y' : 'x';

				let group;
				if (direction === 'x') {
					group = 1 + Math.floor((initialY * xControlsLength) / height);
				} else {
					group = 1 + Math.floor((initialX * yControlsLength) / width);
				}
				const key = `${direction}${group}`;
				return getControlUpdate(currentValues, key, diff);
			});
		},
	});
	let keyboardControlGroup = 1;
	function keyboardHandler(e) {
		switch (e.key) {
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
			case 'ArrowDown':
			case 'ArrowRight':
			case 'ArrowLeft':
				let direction = e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'y' : 'x';
				let diff = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 10 : -10;
				// IMPORTANT: "y" actually means "the longer axis". If the viewport
				// is landscape, flip the direction.
				if (width > height) direction = direction === 'x' ? 'y' : 'x';
				const key = `${direction}${keyboardControlGroup}`;
				handleMove(currentValues => {
					return getControlUpdate(currentValues, key, diff);
				});
				break;
		}
	}
	document.addEventListener('keydown', keyboardHandler);

	settingsContainer.classList.add('populated');

	return () => {
		settingsContainer.classList.remove('populated');
		sliderFeedback.destroy();
		touchCleanup();
		document.removeEventListener('keydown', keyboardHandler);
		titleEl.textContent = '';
		[controlsXContainer, controlsYContainer, controlsListMove].forEach(container => {
			while (container.firstChild) {
				container.removeChild(container.firstChild);
			}
		});
	};
}

export default attachControls;
