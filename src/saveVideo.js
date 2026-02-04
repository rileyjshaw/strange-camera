const downloadLink = document.createElement('a');

export default async function saveVideo(blob, type, filename, text, options = {}) {
	if (!options.preventShare && navigator.share) {
		try {
			const file = new File([blob], filename, { type });
			const shareData = { files: [file] };
			if (text) shareData.text = text;
			await navigator.share(shareData);
			return;
		} catch (err) {
			if (err?.name === 'AbortError') return;
		}
	}

	downloadLink.download = filename;
	downloadLink.href = URL.createObjectURL(blob);
	downloadLink.click();
	URL.revokeObjectURL(downloadLink.href);
}
