// Shared helpers for sorted passes (injected into 1–4).
const ivec2 SORT_DIRS[4] = ivec2[4](
	ivec2(-1, 0),
	ivec2(1, 0),
	ivec2(0, -1),
	ivec2(0, 1)
);

const int SORT_DIR_NONE = 4;

ivec2 decodePos(uint idx, ivec2 size) {
	int n = int(idx);
	return ivec2(n % size.x, n / size.x);
}

uint encodePos(ivec2 pos, ivec2 size) {
	return uint(pos.y * size.x + pos.x);
}

ivec2 getCellFromScreen(ivec2 screenCoord, int pixelSize) {
	return screenCoord / pixelSize;
}

ivec2 cellToScreenAnchor(ivec2 cellCoord, int pixelSize) {
	return cellCoord * pixelSize;
}

ivec2 cellToScreenSample(ivec2 cellCoord, int pixelSize) {
	return cellToScreenAnchor(cellCoord, pixelSize) + ivec2(pixelSize >> 1);
}

bool inBounds(ivec2 coord, ivec2 size) {
	return coord.x >= 0 && coord.y >= 0 && coord.x < size.x && coord.y < size.y;
}

bool isCellInBounds(ivec2 cellCoord, ivec2 activeCells) {
	return inBounds(cellCoord, activeCells);
}

int wrapInt(int value, int size) {
	if (size <= 0) return 0;
	int m = value % size;
	return m < 0 ? m + size : m;
}

ivec2 wrapCellCoord(ivec2 cellCoord, ivec2 activeCells) {
	return ivec2(
		wrapInt(cellCoord.x, activeCells.x),
		wrapInt(cellCoord.y, activeCells.y)
	);
}

int wrapLookDistAxis(int lookDist, int axisCells) {
	if (axisCells <= 1) return 0;
	int maxDist = axisCells - 1;
	int dist = abs(lookDist);
	if (dist < 1) dist = 1;
	dist = ((dist - 1) % maxDist) + 1;

	if ((dist & 1) == 0) {
		dist += 1;
		if (dist > maxDist) {
			dist = maxDist;
			if ((dist & 1) == 0) {
				dist = max(1, dist - 1);
			}
		}
	}
	return dist;
}

int wrapLookDistForDir(int dir, int lookDist, ivec2 activeCells) {
	bool isHorizontal = dir == 0 || dir == 1;
	return wrapLookDistAxis(lookDist, isHorizontal ? activeCells.x : activeCells.y);
}
