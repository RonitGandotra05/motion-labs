# Media handling, timeline navigation, and export

## Implemented

The editor layout stays in place. Open, Save, and Export are available from File (and File commands in the compact menu). Empty space in the project media bin opens the file picker. The Program Monitor's promotional empty state is removed.

Timeline zoom keeps the playhead in place when it is visible, or the viewport center otherwise. Alt/Option + wheel and trackpad pinch zoom at the pointer. `+`/`-` zoom and `\` fits the sequence. The bottom zoom scroll bar pans by dragging its body and changes the visible range by dragging its ends. The first imported sequence fits automatically. Only visible ruler ticks, clips, and waveform pixels are drawn.

Audio waveforms contain actual signed peaks, with separate stereo channels and silent sections on the baseline. A worker decodes packets incrementally and builds multiple levels of peak detail, up to 1,000 bins per second. Zoom and scrolling redraw from the appropriate level rather than rescanning the full decoded audio. Peak cache size is capped at 32 MiB and compressed input cache at 4 MiB per worker. Processing is serialized, duplicate requests are shared, and abandoned tasks are canceled.

Export lazily loads Mediabunny and encodes a deterministic timeline rather than recording wall-clock playback. Video frames and one-second audio mixes are interleaved with encoder backpressure. Audio respects source offsets, clip boundaries, gaps, playback rate, clip/track volume, mute/solo, fades, panning, ducking and EQ. Linked muted video does not double the separate audio lane. Export ends at the last edit instead of the editor's historical duration. MP4 uses H.264/AAC; WebM uses VP9 or VP8 with Opus. Audio-only options are WAV, M4A and WebM audio. An imported supported media file can therefore be converted by adding it to the timeline and choosing the output format in File → Export.

The export dialog shows progress through rendering and finalization, supports cancellation, and disables settings while rendering. Progress does not scrub or repeatedly seek the editor preview. Unsupported codecs produce an error instead of silently dropping audio or changing file formats. Custom HTML/AI components are explicitly blocked from video export because they cannot yet be faithfully rasterized; they are never silently omitted. Browser codec support varies; selecting a format runs an encoder capability check at export time. WebM is the alternative when native AAC encoding is unavailable.

Output streams into a temporary origin-private file where supported; Blob chunks are the fallback. The temporary file is removed after the download starts, or immediately on error/cancellation. No server upload or FFmpeg WASM download is required. Metadata probes release their media elements, project saves are debounced, and IndexedDB reuses a connection. Preview UI updates are capped at 30 Hz while the media elements play natively.

## Useful open-source references

These are alternatives and engineering references, rather than exact Premiere replicas.

| Project | Useful ideas | Fit for Motion Labs |
| --- | --- | --- |
| [OpenCut](https://github.com/OpenCut-app/OpenCut) and [OpenCut Classic](https://github.com/OpenCut-app/opencut-classic) | Browser editing, track models, export orchestration; the main project also explores a Rust media core | Study the browser version's abstractions. Replacing this app with its entire editor would be a separate migration. |
| [Kdenlive editing](https://docs.kdenlive.org/en/cutting_and_assembling/editing.html) and [sequence controls](https://docs.kdenlive.org/en/user_interface/menu/sequence_menu.html) | Linked A/V edits, timeline navigation, fit-to-project, audio waveform controls, proxy previews | Good interaction references; proxy generation is a possible next step for high-resolution sources on older hardware. |
| [Shotcut](https://shotcut.org/features/) and [MLT](https://www.mltframework.org/) | Multitrack editing, audio waveforms, proxy editing, frame-accurate media processing and broad export support | A native or server-backed MLT/FFmpeg engine is an option if broader codec support becomes necessary. It adds deployment and resource costs. |
| [Mediabunny](https://mediabunny.dev/guide/writing-media-files) | Incremental decoding, timestamped encoding, format conversion and streaming output targets | Used here as a lazy-loaded dependency for browser-native exports and worker waveform extraction. |

[Adobe's navigation documentation](https://helpx.adobe.com/premiere/desktop/edit-projects/change-clip-sequence/navigate-sequences-in-the-timeline.html) was the interaction reference for anchored zoom and the horizontal zoom scroll bar. No editor UI or application source was copied from the projects above. Mediabunny 1.26.0 is used unmodified under its MPL-2.0 license.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build` for routine checks.

`npm run test:media` starts its own local Vite server and uses standalone headless Chromium, not the in-app browser. Prerequisites: FFmpeg/ffprobe on PATH and `npx playwright install chromium`. An existing compatible Chromium executable can be supplied using `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Set `KEEP_MEDIA_TEST_ARTIFACTS=1` to retain media and screenshots in the printed temporary directory.

The media check generates a small 13-minute H.264/AAC fixture with alternating sound/silence. It imports it with 4× CPU throttling, verifies bounded waveform/ruler rendering, blank-bin file picking, zoom, the export dialog's format/progress/cancel controls, trimmed MP4/WebM audio timing, WAV/M4A/Opus outputs and a short 4K export with audible audio. It also covers 2× audio speed, muted tracks and the Blob fallback at 44.1 kHz mono. This is not a benchmark of every older computer or a full 13-minute 4K export.
