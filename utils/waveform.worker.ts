import { ALL_FORMATS, AudioSampleSink, Input, UrlSource } from 'mediabunny';

// Incremental decoding off the UI thread: retain peaks, never the full PCM track.
self.onmessage = async ({ data: { url } }: MessageEvent<{ url: string }>) => {
  const input = new Input({ source: new UrlSource(url, { maxCacheSize: 4 * 1024 * 1024, getRetryDelay: attempts => attempts < 2 ? 0.25 : null }), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error('No audio track');
    if (!await track.canDecode()) throw new Error('Audio preview is unsupported for this codec');
    const duration = await track.computeDuration();
    const binsPerSecond = Math.min(1000, 1_000_000 / Math.max(1, duration));
    const bins = Math.ceil(duration * binsPerSecond) + 1;
    const channels = Math.min(2, track.numberOfChannels);
    const levels: Float32Array[][] = [Array.from({ length: channels }, () => new Float32Array(bins * 2))];
    for await (const sample of new AudioSampleSink(track).samples()) {
      try {
        const samples = new Float32Array(sample.numberOfFrames);
        for (let c = 0; c < channels; c++) {
          sample.copyTo(samples, { planeIndex: c, format: 'f32-planar' });
          const peaks = levels[0][c];
          for (let i = 0; i < samples.length; i++) {
            const bin = Math.floor((sample.timestamp + i / sample.sampleRate) * binsPerSecond);
            if (bin < 0 || bin >= bins) continue;
            peaks[bin * 2] = Math.min(peaks[bin * 2], samples[i]);
            peaks[bin * 2 + 1] = Math.max(peaks[bin * 2 + 1], samples[i]);
          }
        }
      } finally { sample.close(); }
    }
    while (levels.at(-1)![0].length > 1024) {
      levels.push(levels.at(-1)!.map(previous => {
        const next = new Float32Array(Math.ceil(previous.length / 8) * 2);
        for (let i = 0; i < previous.length / 2; i++) {
          const index = Math.floor(i / 4) * 2;
          next[index] = Math.min(next[index], previous[i * 2]);
          next[index + 1] = Math.max(next[index + 1], previous[i * 2 + 1]);
        }
        return next;
      }));
    }
    self.postMessage({ url, peaks: { duration, binsPerSecond, levels } }, { transfer: levels.flat().map(array => array.buffer as ArrayBuffer) });
  } catch (error) { self.postMessage({ url, error: error instanceof Error ? error.message : 'Waveform unavailable' }); }
  finally { input.dispose(); }
};
