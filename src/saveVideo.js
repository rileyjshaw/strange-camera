const downloadLink = document.createElement('a');

export default async function saveVideo(blob, filename, text) {
	if (navigator.share) {
		try {
			const file = new File([blob], filename, { type: blob.type });
			const shareData = { files: [file] };
			if (text) shareData.text = text;
			if (!navigator.canShare || navigator.canShare(shareData)) {
				await navigator.share(shareData);
				return;
			}
		} catch (err) {
			if (err?.name === 'AbortError') return;
		}
	}

	downloadLink.download = filename;
	downloadLink.href = URL.createObjectURL(blob);
	downloadLink.click();
	URL.revokeObjectURL(downloadLink.href);
}
