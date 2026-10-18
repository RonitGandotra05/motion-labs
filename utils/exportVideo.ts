import { EditorElement, Track } from '../types';

export interface ExportFormatOption {
  label: string;
  mimeType: string;
  extension: 'webm' | 'mp4';
}

export interface ExportPreset {
  id: 'hd' | 'full-hd' | 'qhd' | 'uhd-4k';
  label: string;
  longEdge: number;
  bitrateMbps: number;
}

export type ExportMediaType = 'video' | 'audio';

export interface ExportOptions {
  filename: string;
  mediaType?: ExportMediaType;
  // Video-specific options
  fps?: number;
  presetId?: ExportPreset['id'];
  mimeType?: string;
  bitrateMbps?: number;
  // Audio-specific options
  audioFormatId?: 'wav' | 'webm' | 'm4a';
  sampleRate?: 44100 | 48000;
  channels?: 1 | 2;
  bitrateKbps?: number;
}

export {
  exportProjectAudio,
  getSupportedAudioFormats,
  audioBufferToWav,
  type ExportAudioFormatOption,
  type ExportAudioOptions,
  type ExportAudioRenderRequest
} from './exportAudio';

export interface ExportRenderRequest {
  tracks?: Track[];
  signal?: AbortSignal;
  elements: EditorElement[];
  duration: number;
  aspectRatio: string;
  options: ExportOptions;
  onProgress?: (currentTime: number) => void;
}


const exportPresets: ExportPreset[] = [
  { id: 'hd', label: 'HD 720p', longEdge: 1280, bitrateMbps: 8 },
  { id: 'full-hd', label: 'Full HD 1080p', longEdge: 1920, bitrateMbps: 14 },
  { id: 'qhd', label: 'QHD 1440p', longEdge: 2560, bitrateMbps: 24 },
  { id: 'uhd-4k', label: '4K UHD', longEdge: 3840, bitrateMbps: 45 }
];

const supportedFormats: ExportFormatOption[] = [
  { label: 'MP4 (H.264 + AAC)', mimeType: 'video/mp4', extension: 'mp4' },
  { label: 'WebM VP9', mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { label: 'WebM VP8', mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' }
];

const toEven = (value: number) => Math.max(2, Math.round(value / 2) * 2);

const parseAspectRatio = (aspectRatio: string) => {
  const [width, height] = aspectRatio.split(':').map(Number);
  if (!width || !height) return 16 / 9;
  return width / height;
};

const getPresetById = (presetId: ExportPreset['id']) => exportPresets.find((preset) => preset.id === presetId) || exportPresets[1];

export const getExportPresets = () => exportPresets;

export const getSupportedExportFormats = () => {
  return typeof VideoEncoder === 'undefined' ? [] : supportedFormats;
};

export const getExportDimensions = (aspectRatio: string, presetId: ExportPreset['id']) => {
  const preset = getPresetById(presetId);
  const ratio = parseAspectRatio(aspectRatio);

  if (ratio >= 1) {
    return {
      width: toEven(preset.longEdge),
      height: toEven(preset.longEdge / ratio)
    };
  }

  return {
    width: toEven(preset.longEdge * ratio),
    height: toEven(preset.longEdge)
  };
};

export const exportProjectVideo = async (request: ExportRenderRequest) => (await import('./renderVideo')).exportProjectVideo(request);
