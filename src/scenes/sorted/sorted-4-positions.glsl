#version 300 es
// Pass 4 — Apply: execute swaps from proposal/accept; full-res position map.

precision highp float;
precision highp int;

in vec2 v_uv;
out uvec4 outColor;

uniform highp isampler2D u_proposalTex;
uniform highp usampler2D u_acceptTex;
uniform highp usampler2DArray u_history;
uniform int u_historyFrameOffset;
uniform int u_frame;
uniform int u_pixelSize;
uniform int u_lookDist;
uniform float u_heuristic;
uniform int u_activeCellsX;
uniform int u_activeCellsY;

ivec2 getMappedPos(ivec2 coord) {
	ivec2 canvasSize = ivec2(u_resolution);
	if (!inBounds(coord, canvasSize))
		return ivec2(-1);
	float z = historyZ(u_history, u_historyFrameOffset, 1);
	uint idx = texture(u_history, vec3((vec2(coord) + 0.5) / vec2(canvasSize), z)).r;
	uint maxIdx = uint(u_resolution.x * u_resolution.y);
	if (idx >= maxIdx) return ivec2(-1);
	return decodePos(idx, canvasSize);
}

ivec2 fallbackPrevOrIdentity(ivec2 screenCoord, ivec2 canvasSize) {
	ivec2 ownPrevPos = getMappedPos(screenCoord);
	if (inBounds(ownPrevPos, canvasSize)) {
		return ownPrevPos;
	}
	return screenCoord;
}

void main() {
	ivec2 canvasSize = ivec2(u_resolution);
	ivec2 screenCoord = ivec2(gl_FragCoord.xy);
	ivec2 activeCells = ivec2(u_activeCellsX, u_activeCellsY);
	ivec2 cellCoord = getCellFromScreen(screenCoord, u_pixelSize);
	ivec2 cellAnchor = cellToScreenAnchor(cellCoord, u_pixelSize);
	ivec2 offsetInCell = screenCoord - cellAnchor;

	if (u_frame <= 1) {
		outColor = uvec4(encodePos(screenCoord, canvasSize), 0u, 0u, 1u);
		return;
	}

	if (activeCells.x <= 0 || activeCells.y <= 0) {
		ivec2 safePos = fallbackPrevOrIdentity(screenCoord, canvasSize);
		outColor = uvec4(encodePos(safePos, canvasSize), 0u, 0u, 1u);
		return;
	}

	if (!isCellInBounds(cellCoord, activeCells)) {
		ivec2 fringeCell = clamp(cellCoord, ivec2(0), activeCells - 1);
		ivec2 fringeAnchor = cellToScreenAnchor(fringeCell, u_pixelSize);
		ivec2 fringeAnchorPrevPos = getMappedPos(fringeAnchor);
		ivec2 fringeOffset = screenCoord - fringeAnchor;
		ivec2 fringePos = fringeAnchorPrevPos + fringeOffset;
		if (inBounds(fringeAnchorPrevPos, canvasSize) && inBounds(fringePos, canvasSize)) {
			outColor = uvec4(encodePos(fringePos, canvasSize), 0u, 0u, 1u);
			return;
		}
		ivec2 safePos = fallbackPrevOrIdentity(screenCoord, canvasSize);
		outColor = uvec4(encodePos(safePos, canvasSize), 0u, 0u, 1u);
		return;
	}

	ivec2 anchorPrevPos = getMappedPos(cellAnchor);
	if (!inBounds(anchorPrevPos, canvasSize)) {
		ivec2 safePos = fallbackPrevOrIdentity(screenCoord, canvasSize);
		outColor = uvec4(encodePos(safePos, canvasSize), 0u, 0u, 1u);
		return;
	}

	int phase = u_frame & 1;
	int parity = (cellCoord.x + cellCoord.y + phase) & 1;

	ivec2 partnerCoord = ivec2(-1);

	if (parity == 0) {
		ivec2 proposal = texelFetch(u_proposalTex, cellAnchor, 0).rg;
		int myDir = proposal.g;
		if (myDir < SORT_DIR_NONE) {
			int dist = wrapLookDistForDir(myDir, u_lookDist, activeCells);
			if (dist > 0) {
				ivec2 targetCell = wrapCellCoord(cellCoord + SORT_DIRS[myDir] * dist, activeCells);
				ivec2 targetAnchor = cellToScreenAnchor(targetCell, u_pixelSize);
				uint acceptedFromDir = texelFetch(u_acceptTex, targetAnchor, 0).r;
				if (int(acceptedFromDir) == (myDir ^ 1)) {
					partnerCoord = targetAnchor;
				}
			}
		}
	} else {
		uint fromDir = texelFetch(u_acceptTex, cellAnchor, 0).r;
		if (fromDir < uint(SORT_DIR_NONE)) {
			int dist = wrapLookDistForDir(int(fromDir), u_lookDist, activeCells);
			if (dist > 0) {
				ivec2 fromCell = wrapCellCoord(cellCoord + SORT_DIRS[int(fromDir)] * dist, activeCells);
				partnerCoord = cellToScreenAnchor(fromCell, u_pixelSize);
			}
		}
	}

	if (partnerCoord.x >= 0) {
		ivec2 partnerAnchorPrevPos = getMappedPos(partnerCoord);
		ivec2 coherentSwapPos = partnerAnchorPrevPos + offsetInCell;
		if (inBounds(partnerAnchorPrevPos, canvasSize) && inBounds(coherentSwapPos, canvasSize)) {
			outColor = uvec4(encodePos(coherentSwapPos, canvasSize), 0u, 0u, 1u);
			return;
		}
		ivec2 fallbackSwapPos = getMappedPos(partnerCoord + offsetInCell);
		if (inBounds(fallbackSwapPos, canvasSize)) {
			outColor = uvec4(encodePos(fallbackSwapPos, canvasSize), 0u, 0u, 1u);
			return;
		}
	}

	ivec2 coherentStayPos = anchorPrevPos + offsetInCell;
	if (inBounds(coherentStayPos, canvasSize)) {
		outColor = uvec4(encodePos(coherentStayPos, canvasSize), 0u, 0u, 1u);
		return;
	}
	ivec2 safePos = fallbackPrevOrIdentity(screenCoord, canvasSize);
	outColor = uvec4(encodePos(safePos, canvasSize), 0u, 0u, 1u);
}
