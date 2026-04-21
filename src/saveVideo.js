const downloadLink = document.createElement('a');
const sharePromptButton = document.getElementById('save-video-prompt');
let pendingShareAbortController = null;

function getFileType(type, filename) {
	const baseType = type?.split(';', 1)[0]?.trim();
	if (baseType) return baseType;
	if (/\.mp4$/i.test(filename)) return 'video/mp4';
	if (/\.webm$/i.test(filename)) return 'video/webm';
	return 'application/octet-stream';
}

function canShare(shareData) {
	return !navigator.canShare || navigator.canShare(shareData);
}

function createShareData(blob, type, filename, text) {
	const file = new File([blob], filename, { type: getFileType(type, filename) });
	const shareData = { files: [file] };
	if (text) shareData.text = text;
	return shareData;
}

async function shareVideo(blob, type, filename, text) {
	const shareData = createShareData(blob, type, filename, text);
	if (canShare(shareData)) {
		await navigator.share(shareData);
		return true;
	}

	if (text) {
		const filesOnlyShareData = createShareData(blob, type, filename);
		if (canShare(filesOnlyShareData)) {
			await navigator.share(filesOnlyShareData);
			return true;
		}
	}

	return false;
}

function downloadVideo(blob, filename) {
	const url = URL.createObjectURL(blob);
	downloadLink.download = filename;
	downloadLink.href = url;
	downloadLink.click();
	setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function hideSharePrompt() {
	pendingShareAbortController?.abort();
	pendingShareAbortController = null;
	if (sharePromptButton) {
		sharePromptButton.hidden = true;
		sharePromptButton.onclick = null;
	}
}

function showSharePrompt(blob, type, filename, text) {
	if (!sharePromptButton) {
		downloadVideo(blob, filename);
		return;
	}

	hideSharePrompt();
	const abortController = new AbortController();
	pendingShareAbortController = abortController;
	sharePromptButton.hidden = false;
	sharePromptButton.onclick = async () => {
		if (abortController.signal.aborted) return;
		sharePromptButton.hidden = true;
		pendingShareAbortController = null;
		try {
			if (await shareVideo(blob, type, filename, text)) return;
		} catch (err) {
			if (err?.name === 'AbortError') return;
			console.warn('Video share failed after prompt, falling back to download:', err);
		}
		downloadVideo(blob, filename);
	};
}

export default async function saveVideo(blob, type, filename, text, options = {}) {
	hideSharePrompt();

	if (!options.preventShare && navigator.share) {
		try {
			if (await shareVideo(blob, type, filename, text)) return;
		} catch (err) {
			if (err?.name === 'AbortError') return;
			console.warn('Video share failed, waiting for explicit share tap:', err);
			showSharePrompt(blob, type, filename, text);
			return;
		}
	}

	downloadVideo(blob, filename);
}
