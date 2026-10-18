import { StreamTarget } from 'mediabunny';

// OPFS keeps compressed output off the JS heap, including on browsers without a save picker.
// Blob chunks are a compatibility fallback; decoded frames and audio remain bounded in either case.
export const createExportTarget = async (filename: string, mimeType: string) => {
  let directory: FileSystemDirectoryHandle | undefined;
  let name: string | undefined;
  let writable: FileSystemWritableFileStream | undefined;
  let fallback = new Blob();
  try {
    directory = await navigator.storage.getDirectory();
    name = `motionlabs-export-${crypto.randomUUID()}`;
    const handle = await directory.getFileHandle(name, { create: true });
    writable = await handle.createWritable();
  } catch {
    // Private browsing and older browsers may not offer OPFS.
    if (directory && name) await directory.removeEntry(name).catch(() => {});
    directory = undefined; name = undefined;
  }
  const target = new StreamTarget(new WritableStream({
    async write(chunk) {
      if (writable) await writable.write(chunk);
      else {
        // Blob slices also support header rewrites (for example RIFF/WAV).
        fallback = new Blob([fallback.slice(0, chunk.position), chunk.data, fallback.slice(chunk.position + chunk.data.byteLength)]);
      }
    }
  }), { chunked: true, chunkSize: 1024 * 1024 });
  let closed = false;
  return {
    target,
    async download() {
      if (writable) { await writable.close(); closed = true; }
      const blob = directory && name && writable
        ? await (await directory.getFileHandle(name)).getFile()
        : new Blob([fallback], { type: mimeType });
      // OPFS File objects have no MIME type; set it explicitly for media downloads.
      const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      // Keep the OPFS file alive until the browser has consumed the download URL.
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        if (directory && name) directory.removeEntry(name).catch(() => {});
      }, 60_000);
    },
    async abort() {
      if (writable && !closed) await writable.abort().catch(() => {});
      if (directory && name) await directory.removeEntry(name).catch(() => {});
    }
  };
};
