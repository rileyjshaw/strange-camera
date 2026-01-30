export default function handleTouch(
	element,
	{ onTap, onTapStart, onMove },
	{ moveThresholdPx = 12, tapThresholdMs = 250, once = false } = {}
) {
	let latestTouch = null;
	let isCurrentTapInvalid = false;
	let tapCount = 0;
	let finalTapResolver = null;
	let finalTapResolverTimeout = null;
	const prevTouchCoordinates = {};

	function handleTouchStart(e) {
		const touch = e.changedTouches[0];
		if (!touch) return;

		if (finalTapResolver) {
			finalTapResolver(false);
			clearTimeout(finalTapResolverTimeout);
			finalTapResolver = null;
		}
		isCurrentTapInvalid = e.touches.length > 1; // Only allow single-finger taps.

		const now = Date.now();
		if (isCurrentTapInvalid || (latestTouch && now - latestTouch.time > tapThresholdMs)) {
			tapCount = 0;
		}
		if (!isCurrentTapInvalid) {
			++tapCount;
			onTapStart?.(tapCount);
		}

		latestTouch = { id: touch.identifier, time: now };
		prevTouchCoordinates[touch.identifier] = {
			x: touch.clientX,
			y: touch.clientY,
			initialX: touch.clientX,
			initialY: touch.clientY,
		};
	}

	function handleTouchMove(e) {
		if (latestTouch.id === null) return;

		const touch = Array.from(e.changedTouches).find(touch => touch.identifier === latestTouch.id);
		if (!touch) return;

		const prevCoords = prevTouchCoordinates[latestTouch.id];
		if (!prevCoords) return;

		let { x, y, initialX, initialY, direction } = prevCoords;

		if (direction && once) return;

		const diffX = touch.clientX - x;
		const diffY = y - touch.clientY; // +ve when moving up.

		if (!direction && (Math.abs(diffX) > moveThresholdPx || Math.abs(diffY) > moveThresholdPx)) {
			direction = Math.abs(diffX) > Math.abs(diffY) ? 'x' : 'y';
			prevTouchCoordinates[latestTouch.id].direction = direction;
			isCurrentTapInvalid = true;
		}
		if (!direction || !onMove) return;

		const result = onMove(
			direction,
			direction === 'x' ? diffX : diffY,
			e.touches.length - 1,
			initialX,
			initialY,
			e
		);
		if (result?.skip) return;

		Object.assign(prevTouchCoordinates[latestTouch.id], { x: touch.clientX, y: touch.clientY });
	}

	function handleTouchEnd(e) {
		Array.from(e.changedTouches).forEach(touch => {
			delete prevTouchCoordinates[touch.identifier];
			if (isCurrentTapInvalid || !onTap || touch.identifier !== latestTouch.id) return;
			const touchDuration = Date.now() - latestTouch.time;

			const isLongTap = touchDuration > tapThresholdMs;
			const remaining = isLongTap ? 0 : tapThresholdMs - touchDuration;

			const finalTapPromise = new Promise(resolve => {
				finalTapResolver = resolve;
			});
			finalTapResolverTimeout = setTimeout(() => {
				finalTapResolver(true);
				finalTapResolver = null;
			}, remaining);

			onTap(touch.clientX, touch.clientY, tapCount, finalTapPromise, isLongTap, e);
		});
	}

	element.addEventListener('touchstart', handleTouchStart);
	element.addEventListener('touchmove', handleTouchMove, { passive: false });
	element.addEventListener('touchend', handleTouchEnd);

	return () => {
		element.removeEventListener('touchstart', handleTouchStart);
		element.removeEventListener('touchmove', handleTouchMove, { passive: false });
		element.removeEventListener('touchend', handleTouchEnd);
	};
}
