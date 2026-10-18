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
  signal?: AbortSignal;
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

  if (typeof AudioEncoder !== 'undefined') {
    formats.push({ id: 'webm', label: 'WebM Audio (Opus)', mimeType: 'audio/webm', extension: 'webm', description: 'Compressed audio' });
    formats.push({ id: 'm4a', label: 'AAC / M4A Audio', mimeType: 'audio/mp4', extension: 'm4a', description: 'AAC compressed audio' });
  }

  return formats;
};

export const exportProjectAudio = async (request: ExportAudioRenderRequest) => (await import('./renderAudio')).exportProjectAudio(request);
