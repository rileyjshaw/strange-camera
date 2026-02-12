#version 300 es
// Pass 3 — Accept: receivers (parity 1) pick best incoming proposal.

precision highp float;
precision highp int;

in vec2 v_uv;
out uvec4 outColor;

uniform highp isampler2D u_proposalTex;
uniform int u_pixelSize;
uniform int u_lookDist;
uniform int u_frame;
uniform int u_activeCellsX;
uniform int u_activeCellsY;

void main() {
	ivec2 activeCells = ivec2(u_activeCellsX, u_activeCellsY);
	ivec2 screenCoord = ivec2(gl_FragCoord.xy);
	ivec2 cellCoord = getCellFromScreen(screenCoord, u_pixelSize);
	ivec2 cellAnchor = cellToScreenAnchor(cellCoord, u_pixelSize);

	if (!isCellInBounds(cellCoord, activeCells) || screenCoord != cellAnchor) {
		outColor = uvec4(uint(SORT_DIR_NONE), 0u, 0u, 1u);
		return;
	}

	int phase = u_frame & 1;
	int parity = (cellCoord.x + cellCoord.y + phase) & 1;

	if (parity != 1) {
		outColor = uvec4(uint(SORT_DIR_NONE), 0u, 0u, 1u);
		return;
	}

	int bestPriority = -2147483647;
	uint bestFromDir = uint(SORT_DIR_NONE);
	bool hasValidProposal = false;

	for (int i = 0; i < 4; i++) {
		int dist = wrapLookDistForDir(i, u_lookDist, activeCells);
		if (dist <= 0) continue;
		ivec2 proposerCell = wrapCellCoord(cellCoord + SORT_DIRS[i] * dist, activeCells);

		ivec2 proposerAnchor = cellToScreenAnchor(proposerCell, u_pixelSize);
		ivec2 proposal = texelFetch(u_proposalTex, proposerAnchor, 0).rg;
		int priority = proposal.r;
		int proposedDir = proposal.g;

		if (proposedDir == (i ^ 1) && priority > bestPriority) {
			bestPriority = priority;
			bestFromDir = uint(i);
			hasValidProposal = true;
		}
	}

	if (!hasValidProposal) {
		outColor = uvec4(uint(SORT_DIR_NONE), 0u, 0u, 1u);
		return;
	}

	outColor = uvec4(bestFromDir, 0u, 0u, 1u);
}
