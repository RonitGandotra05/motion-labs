import type { EditorElement, Track } from '../types.ts';

/** Linked clips follow selection; a locked member protects its whole group. */
export function selectedClips(elements: EditorElement[], ids: string[], tracks: Track[], editable = false) {
  const groups = new Set(elements.filter(clip => ids.includes(clip.id)).map(clip => clip.groupId).filter(Boolean));
  const locked = new Set(tracks.filter(track => track.isLocked).map(track => track.id));
  const protectedGroups = new Set(elements.filter(clip => locked.has(clip.trackId)).map(clip => clip.groupId).filter(Boolean));
  return elements.filter(clip => (ids.includes(clip.id) || (clip.groupId && groups.has(clip.groupId))) &&
    (!editable || (!locked.has(clip.trackId) && (!clip.groupId || !protectedGroups.has(clip.groupId)))));
}

export function cloneClips(clips: EditorElement[], startTime: number) {
  if (!clips.length) return [];
  const origin = Math.min(...clips.map(clip => clip.startTime));
  const groups = new Map<string, string>();
  return clips.map(clip => {
    if (clip.groupId && !groups.has(clip.groupId)) groups.set(clip.groupId, crypto.randomUUID());
    return { ...structuredClone(clip), id: crypto.randomUUID(), name: `${clip.name} Copy`,
      startTime: startTime + clip.startTime - origin, groupId: clip.groupId ? groups.get(clip.groupId) : undefined };
  });
}

/** Paste insert opens space across unlocked tracks, splitting clips at the playhead. */
export function pasteClips(elements: EditorElement[], tracks: Track[], clipboard: EditorElement[], time: number, insert = false) {
  const pasted = cloneClips(clipboard, time);
  if (!pasted.length) return { elements, tracks, pastedIds: [] as string[] };
  const nextTracks = [...tracks];
  const destinations = new Map<number, number>();
  for (const clip of pasted) {
    if (!destinations.has(clip.trackId)) {
      const track = nextTracks.find(track => track.id === clip.trackId && !track.isLocked);
      if (track) destinations.set(clip.trackId, track.id);
      else {
        const id = Math.max(-1, ...nextTracks.map(track => track.id)) + 1;
        nextTracks.push({ id, name: clip.type === 'AUDIO' ? 'Audio' : 'Video', type: clip.type === 'AUDIO' ? 'audio' : 'video', isLocked: false, isVisible: true });
        destinations.set(clip.trackId, id);
      }
    }
    clip.trackId = destinations.get(clip.trackId)!;
  }
  const span = Math.max(...pasted.map(clip => clip.startTime + clip.duration)) - time;
  const locked = new Set(tracks.filter(track => track.isLocked).map(track => track.id));
  const rightGroups = new Map<string, string>();
  const shifted = insert ? elements.flatMap(clip => {
    if (locked.has(clip.trackId) || clip.startTime + clip.duration <= time) return [clip];
    if (clip.startTime >= time) return [{ ...clip, startTime: clip.startTime + span }];
    const leftDuration = time - clip.startTime;
    if (clip.groupId && !rightGroups.has(clip.groupId)) rightGroups.set(clip.groupId, crypto.randomUUID());
    return [{ ...clip, duration: leftDuration }, { ...structuredClone(clip), id: crypto.randomUUID(),
      startTime: time + span, duration: clip.duration - leftDuration,
      mediaOffset: clip.mediaOffset + leftDuration * (clip.props.playbackRate || 1),
      groupId: clip.groupId ? rightGroups.get(clip.groupId) : undefined }];
  }) : elements;
  return { elements: [...shifted, ...pasted], tracks: nextTracks, pastedIds: pasted.map(clip => clip.id) };
}

const intervals = (clips: EditorElement[]) => {
  const merged: [number, number][] = [];
  for (const clip of [...clips].sort((a, b) => a.startTime - b.startTime)) {
    const end = clip.startTime + clip.duration;
    const last = merged[merged.length - 1];
    if (last && clip.startTime <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([clip.startTime, end]);
  }
  return merged;
};

/** Ripple deletion is safe only when other clips on the affected tracks do not cross the removed intervals. */
export function canRippleDelete(elements: EditorElement[], selection: EditorElement[]) {
  if (!selection.length) return false;
  const ids = new Set(selection.map(clip => clip.id));
  return !elements.some(clip => !ids.has(clip.id) && selection.some(selected => selected.trackId === clip.trackId &&
    selected.startTime < clip.startTime + clip.duration && selected.startTime + selected.duration > clip.startTime));
}

export function deleteClips(elements: EditorElement[], selection: EditorElement[], ripple = false) {
  if (ripple && !canRippleDelete(elements, selection)) return elements;
  const ids = new Set(selection.map(clip => clip.id));
  const ranges = new Map<number, [number, number][]>();
  for (const clip of selection) if (!ranges.has(clip.trackId)) ranges.set(clip.trackId, intervals(selection.filter(other => other.trackId === clip.trackId)));
  return elements.filter(clip => !ids.has(clip.id)).map(clip => {
    if (!ripple) return clip;
    const shift = (ranges.get(clip.trackId) || []).reduce((sum, [start, end]) => sum + (end <= clip.startTime ? end - start : 0), 0);
    return shift ? { ...clip, startTime: clip.startTime - shift } : clip;
  });
}
