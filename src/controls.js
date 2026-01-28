import handleTouch from './handleTouch';

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
const controlsListTap = document.getElementById('controls-list-tap');

function attachControls(scene, handleMove) {
	const [xControlsLength, yControlsLength] = scene.controls.map(arr => arr.length);
	const precisionOverrides = scene.controlPrecision ?? {};

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
	const precision = Object.assign({}, precisionDefaults, precisionOverrides);
	const controlModifiers = scene.controlModifiers ?? {};

	function computeValue(currentValues, key, diff) {
		const newValue = currentValues[key] + diff * precision[key];
		if (controlModifiers[key]?.loop) {
			return (1 + newValue) % 1;
		}
		return Math.max(0, Math.min(1, newValue));
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
				return { [key]: computeValue(currentValues, key, diff) };
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
					return { [key]: computeValue(currentValues, key, diff) };
				});
				break;
		}
	}
	document.addEventListener('keydown', keyboardHandler);

	settingsContainer.classList.add('populated');

	return () => {
		settingsContainer.classList.remove('populated');
		touchCleanup();
		document.removeEventListener('keydown', keyboardHandler);
		titleEl.textContent = '';
		[controlsXContainer, controlsYContainer, controlsListMove, controlsListTap].forEach(container => {
			while (container.firstChild) {
				container.removeChild(container.firstChild);
			}
		});
	};
}

export default attachControls;
