import { AudioBufferSource, Mp4OutputFormat, Output, WavOutputFormat, WebMOutputFormat, canEncodeAudio } from 'mediabunny';
import { type ExportAudioRenderRequest } from './exportAudio';
import { createExportTarget } from './exportTarget';
import { renderTimelineAudio } from './timelineAudio';

export const exportProjectAudio = async ({ elements, tracks = [], duration, options, onProgress, signal }: ExportAudioRenderRequest) => {
  const codec = options.formatId === 'wav' ? 'pcm-s16' : options.formatId === 'm4a' ? 'aac' : 'opus';
  if (!await canEncodeAudio(codec, { sampleRate: options.sampleRate, numberOfChannels: options.channels })) throw new Error('This browser cannot encode this audio format. Choose WAV or WebM.');
  const extension = options.formatId;
  const file = await createExportTarget(`${options.filename}.${extension}`, options.mimeType);
  const format = extension === 'wav' ? new WavOutputFormat() : extension === 'm4a' ? new Mp4OutputFormat({ fastStart: 'fragmented' }) : new WebMOutputFormat();
  const output = new Output({ format, target: file.target });
  const source = new AudioBufferSource({ codec, bitrate: (options.bitrateKbps || 256) * 1000 });
  output.addAudioTrack(source);
  let time = 0;
  try {
    signal?.throwIfAborted();
    await output.start();
    for await (const buffer of renderTimelineAudio(elements, tracks, duration, options.sampleRate, options.channels)) {
      signal?.throwIfAborted();
      await source.add(buffer); time += buffer.duration;
      onProgress?.(Math.min(0.99, time / duration));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    source.close(); signal?.throwIfAborted(); await output.finalize();
    signal?.throwIfAborted(); await file.download(); onProgress?.(1);
  } catch (error) { await output.cancel().catch(() => {}); await file.abort(); throw error; }
};
