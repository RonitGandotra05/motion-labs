import { ALL_FORMATS, AudioBufferSource, CanvasSink, CanvasSource, Input, Mp4OutputFormat, Output, UrlSource, WebMOutputFormat, canEncodeAudio, canEncodeVideo, type WrappedCanvas } from 'mediabunny';
import { ElementType, type EditorElement } from '../types';
import { getExportDimensions, type ExportRenderRequest } from './exportVideo';
import { sourceTimeAt } from './mediaTiming';
import { renderTimelineAudio } from './timelineAudio';
import { createExportTarget } from './exportTarget';
type VisualResource = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

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
  const sourceWidth = 'naturalWidth' in resource ? resource.naturalWidth : resource.width;
  const sourceHeight = 'naturalHeight' in resource ? resource.naturalHeight : resource.height;
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
    .filter((el) => el.type !== ElementType.AUDIO && currentTime >= el.startTime && currentTime < el.startTime + el.duration)
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

export const exportProjectVideo = async ({ elements, tracks = [], duration, aspectRatio, options, onProgress, signal }: ExportRenderRequest) => {
  const unsupported = elements.find(el => el.type === ElementType.AI_GENERATED && tracks.find(track => track.id === el.trackId)?.isVisible !== false);
  if (unsupported) throw new Error(`“${unsupported.name}” uses a custom HTML component that cannot be rendered to video yet. Remove it or replace it with an image before exporting.`);
  const mp4 = options.mimeType === 'video/mp4';
  const codec = mp4 ? 'avc' : options.mimeType?.includes('vp8') ? 'vp8' : 'vp9';
  const audioCodec = mp4 ? 'aac' : 'opus';
  const fps = options.fps || 30;
  const { width, height } = getExportDimensions(aspectRatio, options.presetId || 'full-hd');
  const bitrate = (options.bitrateMbps || 14) * 1_000_000;
  if (!await canEncodeVideo(codec, { width, height, bitrate })) throw new Error('This browser cannot encode the selected video quality. Try a lower resolution or WebM.');
  const hasAudio = elements.some(el => (el.type === ElementType.AUDIO || el.type === ElementType.VIDEO) && el.props.src && !el.props.isMuted && !tracks.find(track => track.id === el.trackId)?.isMuted);
  if (hasAudio && !await canEncodeAudio(audioCodec, { sampleRate: 48000, numberOfChannels: 2 })) {
    throw new Error('This browser cannot encode audio in this format. Choose WebM or use a browser with AAC support for MP4.');
  }
  const file = await createExportTarget(`${options.filename}.${mp4 ? 'mp4' : 'webm'}`, mp4 ? 'video/mp4' : 'video/webm');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { await file.abort(); throw new Error('Canvas export is not available.'); }
  const output = new Output({ target: file.target, format: mp4 ? new Mp4OutputFormat({ fastStart: 'fragmented' }) : new WebMOutputFormat() });
  const video = new CanvasSource(canvas, { codec, bitrate });
  const audio = hasAudio ? new AudioBufferSource({ codec: audioCodec, bitrate: 256_000 }) : null;
  output.addVideoTrack(video, { frameRate: fps });
  if (audio) output.addAudioTrack(audio);
  const resources = new Map<string, VisualResource>();
  const decoders = new Map<string, { input: Input; iterator: AsyncGenerator<WrappedCanvas | null> }>();
  const audioIterator = audio ? renderTimelineAudio(elements, tracks, duration) : null;
  const visuals = elements.filter(el => el.type !== ElementType.AUDIO && tracks.find(track => track.id === el.trackId)?.isVisible !== false);
  let audioEnd = 0;
  let lastProgress = 0;
  try {
    signal?.throwIfAborted();
    await document.fonts.ready;
    await output.start();
    const frames = Math.ceil(duration * fps);
    for (let frame = 0; frame < frames; frame++) {
      signal?.throwIfAborted();
      const time = frame / fps;
      // Interleave audio and video to keep the muxer's queues bounded.
      if (audio && time >= audioEnd - 1e-7) {
        const next = await audioIterator!.next();
        if (next.value) { await audio.add(next.value); audioEnd += next.value.duration; }
      }
      for (const el of visuals) {
        if (!el.props.src || time < el.startTime || time >= el.startTime + el.duration) continue;
        if (el.type === ElementType.IMAGE && !resources.has(el.id)) resources.set(el.id, await loadImage(el.props.src));
        if (el.type !== ElementType.VIDEO) continue;
        let decoder = decoders.get(el.id);
        if (!decoder) {
          const input = new Input({ source: new UrlSource(el.props.src, { maxCacheSize: 8 * 1024 * 1024, getRetryDelay: attempts => attempts < 2 ? 0.25 : null }), formats: ALL_FORMATS });
          try {
            const track = await input.getPrimaryVideoTrack();
            if (!track || !await track.canDecode()) throw new Error(`Cannot decode video for “${el.name}”.`);
            const sink = new CanvasSink(track, { poolSize: 2 });
            function* timestamps() {
              for (let index = frame; index < frames && index / fps < el.startTime + el.duration; index++) yield sourceTimeAt(el, index / fps);
            }
            decoder = { input, iterator: sink.canvasesAtTimestamps(timestamps()) }; decoders.set(el.id, decoder);
          } catch (error) { input.dispose(); throw error; }
        }
        const next = await decoder.iterator.next();
        if (!next.done && next.value) resources.set(el.id, next.value.canvas);
        else resources.delete(el.id);
      }
      renderFrame(ctx, width, height, visuals, resources, time);
      await video.add(time, Math.min(1 / fps, duration - time));
      for (const el of visuals) {
        if (time + 1 / fps >= el.startTime + el.duration) {
          const decoder = decoders.get(el.id);
          if (decoder) { await decoder.iterator.return(undefined); decoder.input.dispose(); decoders.delete(el.id); }
          resources.delete(el.id);
        }
      }
      if (performance.now() - lastProgress > 100) {
        onProgress?.(Math.min(duration * 0.99, (frame + 1) / fps));
        lastProgress = performance.now();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    video.close(); audio?.close();
    signal?.throwIfAborted();
    await output.finalize();
    signal?.throwIfAborted();
    await file.download(); onProgress?.(duration);
  } catch (error) {
    await output.cancel().catch(() => {}); await file.abort(); throw error;
  } finally {
    await audioIterator?.return(undefined);
    for (const decoder of decoders.values()) { await decoder.iterator.return(undefined); decoder.input.dispose(); }
    canvas.width = canvas.height = 0;
  }
};

