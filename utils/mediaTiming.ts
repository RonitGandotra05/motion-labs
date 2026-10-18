import type { EditorElement, Track } from '../types';

export const timelineEnd = (elements: EditorElement[]) =>
  elements.reduce((end, clip) => Math.max(end, clip.startTime + clip.duration), 0);

export const sourceTimeAt = (clip: EditorElement, time: number) => {
  const rate = clip.props.playbackRate ?? 1;
  const elapsed = Math.max(0, Math.min(clip.duration, time - clip.startTime));
  return clip.mediaOffset + (clip.props.isFreezeFrame ? 0 : clip.props.isReversed
    ? Math.max(0, clip.duration - elapsed) * rate : elapsed * rate);
};

export const audioGainAt = (clip: EditorElement, elements: EditorElement[], tracks: Track[], time: number) => {
  const track = tracks.find(track => track.id === clip.trackId);
  if (time < clip.startTime || time >= clip.startTime + clip.duration || clip.props.isMuted || track?.isMuted ||
    (tracks.some(track => track.isSoloed) && !track?.isSoloed)) return 0;
  let gain = (clip.props.volume ?? 1) * (track?.volume ?? 1);
  if (clip.props.fadeIn) gain *= Math.min(1, (time - clip.startTime) / clip.props.fadeIn);
  if (clip.props.fadeOut) gain *= Math.min(1, (clip.startTime + clip.duration - time) / clip.props.fadeOut);
  const duck = elements.find(other => other.id !== clip.id && other.props.ducking && !other.props.isMuted &&
    !tracks.find(track => track.id === other.trackId)?.isMuted && time >= other.startTime && time < other.startTime + other.duration);
  return gain * (duck ? duck.props.duckingThreshold ?? 0.2 : 1);
};
