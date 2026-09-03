import { EditorElement, ElementType } from '../types';

export interface ExportFormatOption {
  label: string;
  mimeType: string;
  extension: 'webm';
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

interface ExportRenderRequest {
  elements: EditorElement[];
  duration: number;
  aspectRatio: string;
  options: ExportOptions;
  onProgress?: (currentTime: number) => void;
}

type VisualResource = HTMLImageElement | HTMLVideoElement;

const exportPresets: ExportPreset[] = [
  { id: 'hd', label: 'HD 720p', longEdge: 1280, bitrateMbps: 8 },
  { id: 'full-hd', label: 'Full HD 1080p', longEdge: 1920, bitrateMbps: 14 },
  { id: 'qhd', label: 'QHD 1440p', longEdge: 2560, bitrateMbps: 24 },
  { id: 'uhd-4k', label: '4K UHD', longEdge: 3840, bitrateMbps: 45 }
];

const supportedFormats: ExportFormatOption[] = [
  { label: 'WebM VP9', mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { label: 'WebM VP8', mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { label: 'WebM', mimeType: 'video/webm', extension: 'webm' }
];

const getMediaObjectFit = (fitMode?: EditorElement['props']['mediaFitMode']) => {
  switch (fitMode) {
    case 'fill':
      return 'cover';
    case 'stretch':
      return 'fill';
    default:
      return 'contain';
  }
};

const toEven = (value: number) => Math.max(2, Math.round(value / 2) * 2);

const parseAspectRatio = (aspectRatio: string) => {
  const [width, height] = aspectRatio.split(':').map(Number);
  if (!width || !height) return 16 / 9;
  return width / height;
};

const getPresetById = (presetId: ExportPreset['id']) => exportPresets.find((preset) => preset.id === presetId) || exportPresets[1];

export const getExportPresets = () => exportPresets;

export const getSupportedExportFormats = () => {
  if (typeof MediaRecorder === 'undefined') return [];
  return supportedFormats.filter((format) => MediaRecorder.isTypeSupported(format.mimeType));
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

const waitForEvent = <T extends Event>(target: EventTarget, eventName: string) =>
  new Promise<T>((resolve, reject) => {
    const onSuccess = (event: Event) => {
      cleanup();
      resolve(event as T);
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed while waiting for ${eventName}`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess as EventListener);
      target.removeEventListener('error', onError as EventListener);
    };

    target.addEventListener(eventName, onSuccess as EventListener, { once: true });
    target.addEventListener('error', onError as EventListener, { once: true });
  });

const loadImage = async (src: string) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;

  if (image.complete && image.naturalWidth > 0) return image;
  await waitForEvent(image, 'load');
  return image;
};

const loadMediaElement = async <T extends HTMLMediaElement>(element: T, src: string) => {
  element.preload = 'auto';
  element.src = src;
  element.crossOrigin = 'anonymous';
  element.muted = true;
  element.playsInline = true;
  element.setAttribute('playsinline', 'true');

  if (element.readyState >= 1) return element;
  await waitForEvent(element, 'loadedmetadata');
  return element;
};

const getTransitionState = (el: EditorElement, currentTime: number) => {
  const elapsedTime = currentTime - el.startTime;
  const remainingTime = (el.startTime + el.duration) - currentTime;
  let opacity = 1;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  if (el.transitionIn && el.transitionIn.type !== 'none' && elapsedTime < el.transitionIn.duration) {
    const progress = Math.max(0, elapsedTime / el.transitionIn.duration);
    switch (el.transitionIn.type) {
      case 'fade':
      case 'dissolve':
        opacity = progress;
        break;
      case 'zoom-in':
        opacity = progress;
        scale = 0.5 + (0.5 * progress);
        break;
      case 'zoom-out':
        opacity = progress;
        scale = 1.5 - (0.5 * progress);
        break;
      case 'wipe-left':
        translateX = (1 - progress) * 100;
        break;
      case 'wipe-right':
        translateX = (progress - 1) * 100;
        break;
      case 'wipe-up':
        translateY = (1 - progress) * 100;
        break;
      case 'wipe-down':
        translateY = (progress - 1) * 100;
        break;
    }
  }

  if (el.transitionOut && el.transitionOut.type !== 'none' && remainingTime < el.transitionOut.duration) {
    const progress = Math.max(0, remainingTime / el.transitionOut.duration);
    switch (el.transitionOut.type) {
      case 'fade':
      case 'dissolve':
        opacity = Math.min(opacity, progress);
        break;
      case 'zoom-in':
        opacity = Math.min(opacity, progress);
        scale = 1.5 - (0.5 * progress);
        break;
      case 'zoom-out':
        opacity = Math.min(opacity, progress);
        scale = 0.5 + (0.5 * progress);
        break;
      case 'wipe-left':
        translateX = (progress - 1) * 100;
        break;
      case 'wipe-right':
        translateX = (1 - progress) * 100;
        break;
      case 'wipe-up':
        translateY = (progress - 1) * 100;
        break;
      case 'wipe-down':
        translateY = (1 - progress) * 100;
        break;
    }
  }

  return { opacity, scale, translateX, translateY };
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
};

const getMediaSourceRect = (el: EditorElement, resource: VisualResource) => {
  const sourceWidth = resource instanceof HTMLVideoElement ? resource.videoWidth : resource.naturalWidth;
  const sourceHeight = resource instanceof HTMLVideoElement ? resource.videoHeight : resource.naturalHeight;
  const cropLeft = (el.props.cropLeft ?? 0) / 100;
  const cropRight = (el.props.cropRight ?? 0) / 100;
  const cropTop = (el.props.cropTop ?? 0) / 100;
  const cropBottom = (el.props.cropBottom ?? 0) / 100;
  const sx = sourceWidth * cropLeft;
  const sy = sourceHeight * cropTop;
  const sw = Math.max(1, sourceWidth * (1 - cropLeft - cropRight));
  const sh = Math.max(1, sourceHeight * (1 - cropTop - cropBottom));
  return { sx, sy, sw, sh, sourceWidth, sourceHeight };
};

const drawMediaElement = (
  ctx: CanvasRenderingContext2D,
  el: EditorElement,
  resource: VisualResource,
  canvasWidth: number,
  canvasHeight: number
) => {
  const width = (el.width / 100) * canvasWidth;
  const height = (el.height / 100) * canvasHeight;
  const x = (el.x / 100) * canvasWidth;
  const y = (el.y / 100) * canvasHeight;
  const fitMode = getMediaObjectFit(el.props.mediaFitMode);
  const { sx, sy, sw, sh } = getMediaSourceRect(el, resource);
  const zoom = el.props.mediaZoom ?? 1;

  let drawWidth = width;
  let drawHeight = height;

  if (fitMode !== 'fill') {
    const sourceAspectRatio = sw / sh;
    const frameAspectRatio = width / height;

    if (fitMode === 'contain') {
      if (sourceAspectRatio > frameAspectRatio) {
        drawHeight = width / sourceAspectRatio;
      } else {
        drawWidth = height * sourceAspectRatio;
      }
    } else if (fitMode === 'cover') {
      if (sourceAspectRatio > frameAspectRatio) {
        drawWidth = height * sourceAspectRatio;
      } else {
        drawHeight = width / sourceAspectRatio;
      }
    }
  }

  drawWidth *= zoom;
  drawHeight *= zoom;

  const filters = [
    el.props.blur ? `blur(${el.props.blur}px)` : '',
    el.props.brightness !== undefined && el.props.brightness !== 1 ? `brightness(${el.props.brightness})` : '',
    el.props.contrast !== undefined && el.props.contrast !== 1 ? `contrast(${el.props.contrast})` : '',
    el.props.saturation !== undefined && el.props.saturation !== 1 ? `saturate(${el.props.saturation})` : '',
    el.props.grayscale ? `grayscale(${el.props.grayscale})` : '',
    el.props.sepia ? `sepia(${el.props.sepia})` : '',
    el.props.hueRotate ? `hue-rotate(${el.props.hueRotate}deg)` : ''
  ].filter(Boolean).join(' ');

  if (filters) ctx.filter = filters;
  ctx.drawImage(
    resource,
    sx,
    sy,
    sw,
    sh,
    x + ((width - drawWidth) / 2),
    y + ((height - drawHeight) / 2),
    drawWidth,
    drawHeight
  );
  ctx.filter = 'none';
};

const drawTextElement = (
  ctx: CanvasRenderingContext2D,
  el: EditorElement,
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number
) => {
  const width = (el.width / 100) * canvasWidth;
  const height = (el.height / 100) * canvasHeight;
  const x = (el.x / 100) * canvasWidth;
  const y = (el.y / 100) * canvasHeight;
  const elapsedTime = currentTime - el.startTime;
  let textContent = el.props.text || '';

  if (el.props.textAnimation === 'typewriter') {
    const animationDuration = el.props.animationDuration || 1;
    const progress = Math.max(0, Math.min(1, elapsedTime / animationDuration));
    textContent = textContent.slice(0, Math.floor(textContent.length * progress));
  }

  if (el.props.backgroundColor) {
    ctx.fillStyle = el.props.backgroundColor;
    ctx.fillRect(x, y, width, height);
  }

  const fontSize = el.props.fontSize || 16;
  const fontWeight = el.props.fontWeight || 400;
  const fontFamily = el.props.fontFamily || 'Inter, sans-serif';
  ctx.fillStyle = el.props.color || '#ffffff';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = el.props.textAlign === 'left' ? 'left' : el.props.textAlign === 'right' ? 'right' : 'center';

  const lineHeight = fontSize * (el.props.lineHeight || 1.2);
  const paddingX = 8;
  const lines = wrapText(ctx, textContent, Math.max(20, width - (paddingX * 2)));
  const textYStart = y + (height / 2) - (((lines.length - 1) * lineHeight) / 2);
  const textX = el.props.textAlign === 'left'
    ? x + paddingX
    : el.props.textAlign === 'right'
      ? x + width - paddingX
      : x + (width / 2);

  if (el.props.textShadowColor) {
    ctx.shadowColor = el.props.textShadowColor;
    ctx.shadowBlur = el.props.textShadowBlur ?? 0;
    ctx.shadowOffsetX = el.props.textShadowX ?? 2;
    ctx.shadowOffsetY = el.props.textShadowY ?? 2;
  }

  lines.forEach((line, index) => {
    ctx.fillText(line, textX, textYStart + (index * lineHeight));
  });

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
};

const drawShapeElement = (
  ctx: CanvasRenderingContext2D,
  el: EditorElement,
  canvasWidth: number,
  canvasHeight: number
) => {
  const width = (el.width / 100) * canvasWidth;
  const height = (el.height / 100) * canvasHeight;
  const x = (el.x / 100) * canvasWidth;
  const y = (el.y / 100) * canvasHeight;
  ctx.fillStyle = el.props.backgroundColor || '#ffffff';
  ctx.fillRect(x, y, width, height);

  if (el.props.borderWidth && el.props.borderColor) {
    ctx.strokeStyle = el.props.borderColor;
    ctx.lineWidth = el.props.borderWidth;
    ctx.strokeRect(x, y, width, height);
  }
};

const getEffectiveVolume = (elements: EditorElement[], element: EditorElement, currentTime: number) => {
  let effectiveVolume = element.props.volume ?? 1;
  if (element.props.isMuted) effectiveVolume = 0;

  const activeDuckingSource = elements.find(e =>
    e.id !== element.id &&
    (e.type === ElementType.VIDEO || e.type === ElementType.AUDIO) &&
    e.props.ducking &&
    currentTime >= e.startTime &&
    currentTime <= e.startTime + e.duration
  );

  if (activeDuckingSource) {
    effectiveVolume *= (activeDuckingSource.props.duckingThreshold ?? 0.2);
  }

  return effectiveVolume;
};

const syncMediaForTime = async (
  elements: EditorElement[],
  resources: Map<string, VisualResource>,
  audioNodes: Map<string, GainNode>,
  currentTime: number
) => {
  const playRequests: Promise<void>[] = [];

  for (const element of elements) {
    if ((element.type !== ElementType.VIDEO && element.type !== ElementType.AUDIO) || !element.props.src) {
      continue;
    }

    const media = resources.get(element.id);
    if (!(media instanceof HTMLMediaElement)) continue;

    const isActive = currentTime >= element.startTime && currentTime <= element.startTime + element.duration;
    const targetTime = Math.max(0, (currentTime - element.startTime) + element.mediaOffset);

    media.playbackRate = element.props.playbackRate ?? 1;
    const gainNode = audioNodes.get(element.id);
    if (gainNode) {
      gainNode.gain.value = isActive ? getEffectiveVolume(elements, element, currentTime) : 0;
    }

    if (!isActive) {
      if (!media.paused) media.pause();
      continue;
    }

    if (Math.abs(media.currentTime - targetTime) > 0.12) {
      media.currentTime = targetTime;
    }

    if (media.paused) {
      playRequests.push(media.play().catch(() => { }) as Promise<void>);
    }
  }

  await Promise.all(playRequests);
};

const renderFrame = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  elements: EditorElement[],
  resources: Map<string, VisualResource>,
  currentTime: number
) => {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const activeElements = [...elements]
    .filter((el) => el.type !== ElementType.AUDIO && currentTime >= el.startTime && currentTime <= el.startTime + el.duration)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  for (const el of activeElements) {
    const transition = getTransitionState(el, currentTime);
    const width = (el.width / 100) * canvasWidth;
    const height = (el.height / 100) * canvasHeight;
    const x = (el.x / 100) * canvasWidth;
    const y = (el.y / 100) * canvasHeight;

    ctx.save();
    ctx.globalAlpha = transition.opacity * (el.props.opacity ?? 1);
    ctx.translate(x + (width / 2), y + (height / 2));
    ctx.translate((transition.translateX / 100) * width, (transition.translateY / 100) * height);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.scale((el.flipX ? -1 : 1) * transition.scale, (el.flipY ? -1 : 1) * transition.scale);
    ctx.translate(-(x + (width / 2)), -(y + (height / 2)));

    if ((el.type === ElementType.VIDEO || el.type === ElementType.IMAGE) && el.props.src) {
      const resource = resources.get(el.id);
      if (resource) {
        drawMediaElement(ctx, el, resource, canvasWidth, canvasHeight);
      }
    } else if (el.type === ElementType.TEXT) {
      drawTextElement(ctx, el, canvasWidth, canvasHeight, currentTime);
    } else if (el.type === ElementType.SHAPE) {
      drawShapeElement(ctx, el, canvasWidth, canvasHeight);
    }

    ctx.restore();
  }
};

export const exportProjectVideo = async ({
  elements,
  duration,
  aspectRatio,
  options,
  onProgress
}: ExportRenderRequest) => {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser.');
  }

  const fps = options.fps || 30;
  const presetId = options.presetId || 'full-hd';
  const bitrateMbps = options.bitrateMbps || 14;
  const mimeType = options.mimeType || 'video/webm';

  const { width, height } = getExportDimensions(aspectRatio, presetId);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  if (!ctx) {
    throw new Error('Canvas export is not available in this browser.');
  }

  const visualElements = elements.filter((element) => element.type !== ElementType.AUDIO);
  const mediaElements = elements.filter(
    (element) => (element.type === ElementType.VIDEO || element.type === ElementType.AUDIO) && element.props.src
  );
  const imageElements = visualElements.filter((element) => element.type === ElementType.IMAGE && element.props.src);

  const resources = new Map<string, VisualResource>();
  await Promise.all(imageElements.map(async (element) => {
    resources.set(element.id, await loadImage(element.props.src!));
  }));
  await Promise.all(mediaElements.map(async (element) => {
    const tagName = element.type === ElementType.AUDIO ? 'audio' : 'video';
    const media = document.createElement(tagName) as HTMLMediaElement;
    await loadMediaElement(media, element.props.src!);
    resources.set(element.id, media as VisualResource);
  }));

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();
  const destination = audioContext.createMediaStreamDestination();
  const audioNodes = new Map<string, GainNode>();

  mediaElements.forEach((element) => {
    const media = resources.get(element.id);
    if (!(media instanceof HTMLMediaElement)) return;
    const source = audioContext.createMediaElementSource(media);
    const gain = audioContext.createGain();
    source.connect(gain);
    gain.connect(destination);
    audioNodes.set(element.id, gain);
  });

  const canvasStream = canvas.captureStream(fps);
  const mixedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destination.stream.getAudioTracks()
  ]);

  const recorder = new MediaRecorder(mixedStream, {
    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
    videoBitsPerSecond: Math.round(bitrateMbps * 1_000_000)
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  let animationFrame = 0;

  try {
    await audioContext.resume();
    await syncMediaForTime(elements, resources, audioNodes, 0);
    renderFrame(ctx, width, height, elements, resources, 0);

    await new Promise<void>((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Export recording failed.'));
      recorder.onstop = () => resolve();

      const startTime = performance.now();

      const tick = async () => {
        const exportTime = Math.min(duration, (performance.now() - startTime) / 1000);
        onProgress?.(exportTime);
        await syncMediaForTime(elements, resources, audioNodes, exportTime);
        renderFrame(ctx, width, height, elements, resources, exportTime);

        if (exportTime >= duration) {
          recorder.stop();
          return;
        }

        animationFrame = window.requestAnimationFrame(() => {
          tick().catch(reject);
        });
      };

      recorder.start(250);
      tick().catch(reject);
    });
  } finally {
    window.cancelAnimationFrame(animationFrame);
    resources.forEach((resource) => {
      if (resource instanceof HTMLMediaElement) {
        resource.pause();
        resource.removeAttribute('src');
        resource.load();
      }
    });
    audioContext.close().catch(() => { });
    mixedStream.getTracks().forEach((track) => track.stop());
    canvasStream.getTracks().forEach((track) => track.stop());
  }

  const blob = new Blob(chunks, { type: options.mimeType });
  const url = URL.createObjectURL(blob);
  const extension = supportedFormats.find((format) => format.mimeType === options.mimeType)?.extension || 'webm';
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${options.filename}.${extension}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
