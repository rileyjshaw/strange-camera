import handleTouch from './handleTouch';

const precisionDefaults = {
	x1: 0.01,
	x2: 0.01,
	x3: 0.01,
	y1: 0.01,
	y2: 0.01,
	y3: 0.01,
};

let width = 0;
let height = 0;

const resizeObserver = new ResizeObserver(() => {
	width = document.body.clientWidth;
	height = document.body.clientHeight;
});
resizeObserver.observe(document.body);

const settingsContainer = document.getElementById('settings');
const titleEl = document.getElementById('title');
const controlsXContainer = document.getElementById('controls-x');
const controlsYContainer = document.getElementById('controls-y');
const controlsListMove = document.getElementById('controls-list-move');
const controlsListTap = document.getElementById('controls-list-tap');

function attachControls(scene, onMove) {
	const [xControlsLength, yControlsLength] = scene.controls.map(arr => arr.length);
	const precisionOverrides = scene.precisionOverrides ?? {};

	titleEl.textContent = scene.name;
	scene.controls.forEach((controls, i) => {
		controls.forEach(controlName => {
			const div = document.createElement('div');
			const li = document.createElement('li');
			li.textContent = controlName;
			(i ? controlsYContainer : controlsXContainer).appendChild(div);
			controlsListMove.appendChild(li);
		});
	});

	const precision = Object.assign({}, precisionDefaults, precisionOverrides);
	const touchCleanup = handleTouch(document.body, {
		onMove(direction, diff, nTouches, initialX, initialY) {
			if (nTouches > 1) return;

			// IMPORTANT: “y” actually means “the longer axis”. If the viewport
			// is landscape, flip the direction.
			if (width > height) direction = direction === 'x' ? 'y' : 'x';

			let group;
			if (direction === 'x') {
				group = 1 + Math.floor((initialY * yControlsLength) / height);
			} else {
				group = 1 + Math.floor((initialX * xControlsLength) / width);
			}
			const key = `${direction}${group}`;
			return onMove(currentValues => {
				return { [key]: Math.max(0, Math.min(1, currentValues[key] + diff * precision[key])) };
			});
		},
	});

	settingsContainer.classList.add('populated');

	return () => {
		settingsContainer.classList.remove('populated');
		touchCleanup();
		titleEl.textContent = '';
		[controlsXContainer, controlsYContainer, controlsListMove, controlsListTap].forEach(container => {
			while (container.firstChild) {
				container.removeChild(container.firstChild);
			}
		});
	};
}

export default attachControls;
