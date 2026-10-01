// iPadOS reports itself as a Mac, hence the touch-points check.
function isIOS(): boolean {
  const { userAgent, platform, maxTouchPoints } = navigator;
  return /iP(hone|ad|od)/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  // Safari/iOS ignore clicks on anchors that aren't in the document.
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // iOS starts the download asynchronously — revoking right after click()
  // kills the blob before it's read and the download silently fails.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Saves a file from the browser on every platform.
 *
 * iOS: `<a download>` is unreliable there (and can't put a PNG in Photos), so
 * we open the native share sheet — "Save Image" / "Save to Files". Share needs
 * a recent user tap; if the browser refuses (long renders can outlive it) we
 * fall back to a normal download. Everywhere else: a regular download. */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (isIOS() && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        // Closing the share sheet is a choice, not a failure — don't re-download.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
  }
  anchorDownload(blob, filename);
}
