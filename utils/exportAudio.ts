import { EditorElement, ElementType, Track } from '../types';

export interface ExportAudioFormatOption {
  id: 'wav' | 'webm' | 'm4a';
  label: string;
  mimeType: string;
  extension: string;
  description: string;
}

export interface ExportAudioOptions {
  filename: string;
  formatId: 'wav' | 'webm' | 'm4a';
  mimeType: string;
  sampleRate: 44100 | 48000;
  channels: 1 | 2;
  bitrateKbps?: number;
}

export interface ExportAudioRenderRequest {
  elements: EditorElement[];
  tracks?: Track[];
  duration: number;
  options: ExportAudioOptions;
  onProgress?: (progress: number) => void;
}

/**
 * Universal zero-dependency 16-bit PCM RIFF WAV encoder.
 * Supports stereo and mono, handles channel downmixing and upmixing.
 */
export const audioBufferToWav = (buffer: AudioBuffer, targetChannels?: number): Blob => {
  const numChannels = targetChannels ?? buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');

  // "fmt " Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // "data" Subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const sourceChannels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    sourceChannels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = 0;
      if (buffer.numberOfChannels === 1) {
        sample = sourceChannels[0][i];
      } else if (numChannels === 1 && buffer.numberOfChannels >= 2) {
        // Downmix to mono
        sample = (sourceChannels[0][i] + sourceChannels[1][i]) * 0.5;
      } else {
        sample = sourceChannels[c < sourceChannels.length ? c : 0][i];
      }

      // Clamp to [-1, 1]
      const clamped = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer
      const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

/**
 * Returns available audio formats supported in the current environment.
 */
export const getSupportedAudioFormats = (): ExportAudioFormatOption[] => {
  const formats: ExportAudioFormatOption[] = [
    {
      id: 'wav',
      label: 'WAV (Lossless Audio)',
      mimeType: 'audio/wav',
      extension: 'wav',
      description: 'Studio quality, uncompressed 16-bit PCM'
    }
  ];

  if (typeof MediaRecorder !== 'undefined') {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      formats.push({
        id: 'webm',
        label: 'WebM Audio (Opus)',
        mimeType: 'audio/webm;codecs=opus',
        extension: 'webm',
        description: 'High-efficiency compressed audio'
      });
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      formats.push({
        id: 'webm',
        label: 'WebM Audio',
        mimeType: 'audio/webm',
        extension: 'webm',
        description: 'Compressed web audio'
      });
    }

    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      formats.push({
        id: 'm4a',
        label: 'AAC / M4A Audio',
        mimeType: 'audio/mp4',
        extension: 'm4a',
        description: 'Standard AAC compressed audio'
      });
    }
  }

  return formats;
};

const getTrackVolumeMultiplier = (tracks: Track[], trackId: number): number => {
  const track = tracks.find(t => t.id === trackId);
  if (!track) return 1;
  if (track.isMuted) return 0;
  const anySolo = tracks.some(t => t.isSoloed);
  if (anySolo && !track.isSoloed) return 0;
  return track.volume ?? 1;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const recordAudioBuffer = (buffer: AudioBuffer, mimeType: string, bitrateKbps: number = 256): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      reject(new Error('AudioContext not supported'));
      return;
    }
    const ctx = new AudioContextClass();
    const dest = ctx.createMediaStreamDestination();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(dest);

    const actualMimeType = MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined;
    const recorder = new MediaRecorder(dest.stream, {
      mimeType: actualMimeType,
      audioBitsPerSecond: bitrateKbps * 1000
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error('Failed to encode audio stream.'));
    recorder.onstop = () => {
      ctx.close().catch(() => {});
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
    };

    recorder.start();
    source.start();
    source.onended = () => {
      setTimeout(() => recorder.stop(), 80);
    };
  });
};

/**
 * Real-time playback fallback if decodeAudioData or OfflineAudioContext fails on media sources.
 */
const exportAudioRealtimeFallback = async ({
  elements,
  tracks = [],
  duration,
  options,
  onProgress
}: ExportAudioRenderRequest) => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio API not supported in this browser.');
  const audioContext = new AudioContextClass();
  const destination = audioContext.createMediaStreamDestination();

  const mediaElements = new Map<string, HTMLMediaElement>();
  const audioNodes = new Map<string, GainNode>();

  for (const element of elements) {
    if (!element.props.src) continue;
    const tagName = element.type === ElementType.AUDIO ? 'audio' : 'video';
    const media = document.createElement(tagName) as HTMLMediaElement;
    media.preload = 'auto';
    media.src = element.props.src;
    media.crossOrigin = 'anonymous';
    media.muted = true;
    media.playsInline = true;
    mediaElements.set(element.id, media);
  }

  // Wait for metadata
  await Promise.all(
    Array.from(mediaElements.values()).map(media =>
      media.readyState >= 1 ? Promise.resolve() : new Promise(res => {
        media.onloadedmetadata = () => res(null);
        media.onerror = () => res(null);
      })
    )
  );

  mediaElements.forEach((media, id) => {
    try {
      const source = audioContext.createMediaElementSource(media);
      const gain = audioContext.createGain();
      source.connect(gain);
      gain.connect(destination);
      audioNodes.set(id, gain);
    } catch (e) {
      console.warn('Could not connect media element source:', e);
    }
  });

  const mimeType = options.formatId === 'wav'
    ? (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm')
    : options.mimeType;

  const actualMimeType = MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined;
  const recorder = new MediaRecorder(destination.stream, {
    mimeType: actualMimeType
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  await audioContext.resume();

  await new Promise<void>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Audio export failed.'));
    recorder.onstop = () => resolve();

    const startTime = performance.now();
    recorder.start(250);

    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      onProgress?.(Math.min(1, elapsed / duration));

      elements.forEach(element => {
        const media = mediaElements.get(element.id);
        const gain = audioNodes.get(element.id);
        if (!media || !gain) return;

        const isActive = elapsed >= element.startTime && elapsed <= element.startTime + element.duration;
        const targetTime = Math.max(0, (elapsed - element.startTime) + element.mediaOffset);
        media.playbackRate = element.props.playbackRate ?? 1;

        const trackVol = getTrackVolumeMultiplier(tracks, element.trackId);
        gain.gain.value = isActive ? (element.props.isMuted ? 0 : (element.props.volume ?? 1) * trackVol) : 0;

        if (!isActive) {
          if (!media.paused) media.pause();
          return;
        }

        if (Math.abs(media.currentTime - targetTime) > 0.15) {
          media.currentTime = targetTime;
        }
        if (media.paused) {
          media.play().catch(() => { });
        }
      });

      if (elapsed >= duration) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 50);
  });

  mediaElements.forEach(media => {
    media.pause();
    media.removeAttribute('src');
    media.load();
  });
  audioContext.close().catch(() => { });

  const finalBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
  const ext = options.formatId === 'wav' ? 'webm' : (options.formatId === 'm4a' ? 'm4a' : 'webm');
  downloadBlob(finalBlob, `${options.filename}.${ext}`);
};

/**
 * Main function to export timeline audio.
 * Uses high-speed OfflineAudioContext whenever possible, falling back to real-time recording.
 */
export const exportProjectAudio = async ({
  elements,
  tracks = [],
  duration,
  options,
  onProgress
}: ExportAudioRenderRequest) => {
  // Filter active audio-producing elements
  const audioElements = elements.filter(el => {
    if (el.props.isMuted) return false;
    if (el.type === ElementType.AUDIO && el.props.src) return true;
    if (el.type === ElementType.VIDEO && el.props.src && !el.props.isMuted) return true;
    return false;
  });

  if (audioElements.length === 0) {
    throw new Error('No audio elements found on timeline to export.');
  }

  // Calculate actual audio timeline duration
  const maxEnd = audioElements.reduce((max, el) => Math.max(max, el.startTime + el.duration), 0);
  const exportDuration = Math.max(0.1, duration > 0 ? duration : maxEnd);

  const sampleRate = options.sampleRate || 48000;
  const numChannels = options.channels || 2;
  const totalLengthSamples = Math.max(1, Math.ceil(exportDuration * sampleRate));

  try {
    const OfflineContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineContextClass) {
      throw new Error('OfflineAudioContext is not available.');
    }

    const offlineCtx = new OfflineContextClass(numChannels, totalLengthSamples, sampleRate);

    // Fetch and decode all audio buffers
    const decodedBuffers = new Map<string, AudioBuffer>();

    for (let i = 0; i < audioElements.length; i++) {
      const el = audioElements[i];
      onProgress?.(((i + 1) / audioElements.length) * 0.4);

      const response = await fetch(el.props.src!);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
      decodedBuffers.set(el.id, audioBuffer);
    }

    // Build timeline audio graph in offline context
    for (const el of audioElements) {
      const buffer = decodedBuffers.get(el.id);
      if (!buffer) continue;

      const sourceNode = offlineCtx.createBufferSource();
      sourceNode.buffer = buffer;
      const playbackRate = el.props.playbackRate ?? 1;
      sourceNode.playbackRate.value = playbackRate;

      // Track multiplier
      const trackMultiplier = getTrackVolumeMultiplier(tracks, el.trackId);
      const baseGain = (el.props.volume ?? 1) * trackMultiplier;

      const gainNode = offlineCtx.createGain();
      gainNode.gain.setValueAtTime(baseGain, el.startTime);

      // Handle Fades
      if (el.props.fadeIn && el.props.fadeIn > 0) {
        const fadeInDuration = Math.min(el.props.fadeIn, el.duration);
        gainNode.gain.setValueAtTime(0, el.startTime);
        gainNode.gain.linearRampToValueAtTime(baseGain, el.startTime + fadeInDuration);
      }
      if (el.props.fadeOut && el.props.fadeOut > 0) {
        const fadeOutDuration = Math.min(el.props.fadeOut, el.duration);
        const fadeStart = el.startTime + el.duration - fadeOutDuration;
        gainNode.gain.setValueAtTime(baseGain, fadeStart);
        gainNode.gain.linearRampToValueAtTime(0, el.startTime + el.duration);
      }

      let currentNode: AudioNode = gainNode;
      sourceNode.connect(gainNode);

      // Handle EQ
      if (el.props.highPassFrequency && el.props.highPassFrequency > 0) {
        const hp = offlineCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = el.props.highPassFrequency;
        currentNode.connect(hp);
        currentNode = hp;
      }

      if (el.props.lowPassFrequency && el.props.lowPassFrequency < 20000) {
        const lp = offlineCtx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = el.props.lowPassFrequency;
        currentNode.connect(lp);
        currentNode = lp;
      }

      // Track panning if available
      const track = tracks.find(t => t.id === el.trackId);
      if (track && track.pan !== undefined && track.pan !== 0 && (offlineCtx as any).createStereoPanner) {
        const panner = (offlineCtx as any).createStereoPanner();
        panner.pan.value = track.pan;
        currentNode.connect(panner);
        currentNode = panner;
      }

      currentNode.connect(offlineCtx.destination);

      const offset = Math.max(0, el.mediaOffset || 0);
      const playDuration = Math.max(0, el.duration);
      sourceNode.start(el.startTime, offset, playDuration);
    }

    onProgress?.(0.6);
    const renderedBuffer = await offlineCtx.startRendering();
    onProgress?.(0.9);

    if (options.formatId === 'wav') {
      const wavBlob = audioBufferToWav(renderedBuffer, numChannels);
      downloadBlob(wavBlob, `${options.filename}.wav`);
      onProgress?.(1);
    } else {
      // Compressed audio format (WebM or M4A)
      const blob = await recordAudioBuffer(renderedBuffer, options.mimeType, options.bitrateKbps || 256);
      const ext = options.formatId === 'm4a' ? 'm4a' : 'webm';
      downloadBlob(blob, `${options.filename}.${ext}`);
      onProgress?.(1);
    }
  } catch (error) {
    console.warn('Offline audio render failed, falling back to real-time capture:', error);
    await exportAudioRealtimeFallback({
      elements: audioElements,
      tracks,
      duration: exportDuration,
      options,
      onProgress
    });
    onProgress?.(1);
  }
};
