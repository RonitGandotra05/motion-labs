import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectedClips, cloneClips, pasteClips, deleteClips, canRippleDelete } from '../utils/editing.ts';
import type { EditorElement, Track } from '../types.ts';
const tracks: Track[] = [{ id: 0, name: 'V1', type: 'video', isVisible: true, isLocked: false }, { id: 1, name: 'A1', type: 'audio', isVisible: true, isLocked: false }];
const clip = (id: string, startTime = 0, duration = 5, trackId = 0, groupId?: string): EditorElement => ({ id, startTime, duration, trackId, groupId, type: 'VIDEO' as EditorElement['type'], name: id, mediaOffset: 0, x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 0, props: { playbackRate: 2 } });
test('selection expands linked audio and protects groups containing a locked track', () => {
  const clips = [clip('v', 0, 5, 0, 'linked'), clip('a', 0, 5, 1, 'linked')];
  assert.equal(selectedClips(clips, ['v'], tracks, true).length, 2);
  assert.equal(selectedClips(clips, ['v'], [tracks[0], { ...tracks[1], isLocked: true }], true).length, 0);
});
test('copy preserves spacing and remaps groups without sharing mutable props', () => {
  const original = [clip('a', 2, 5, 0, 'g'), clip('b', 4, 5, 1, 'g')];
  const copied = cloneClips(original, 10);
  assert.deepEqual(copied.map(c => c.startTime), [10, 12]);
  assert.equal(copied[0].groupId, copied[1].groupId);
  assert.notEqual(copied[0].groupId, 'g');
  assert.notEqual(copied[0].props, original[0].props);
});
test('paste insert splits crossing clips, offsets source media by speed and keeps locked tracks fixed', () => {
  const original = [clip('cross', 0, 10), clip('after', 12), clip('locked', 0, 20, 1)];
  const result = pasteClips(original, [tracks[0], { ...tracks[1], isLocked: true }], [clip('copy', 0, 3)], 5, true);
  const split = result.elements.filter(c => c.name === 'cross');
  assert.deepEqual(split.map(c => [c.startTime, c.duration, c.mediaOffset]), [[0, 5, 0], [8, 5, 10]]);
  assert.equal(result.elements.find(c => c.id === 'after')!.startTime, 15);
  assert.equal(result.elements.find(c => c.id === 'locked')!.startTime, 0);
  assert.equal(result.elements.find(c => c.id === result.pastedIds[0])!.startTime, 5);
});
test('paste creates a destination when its original track is missing or locked', () => {
  const result = pasteClips([], [{ ...tracks[0], isLocked: true }], [clip('copy')], 0);
  assert.equal(result.tracks.length, 2);
  assert.equal(result.elements[0].trackId, 1);
});
test('ripple deletion merges overlapping selected intervals, affects only selected tracks and guards surviving overlaps', () => {
  const clips = [clip('a', 0, 5), clip('b', 3, 5), clip('next', 10), clip('other', 10, 5, 1)];
  const result = deleteClips(clips, clips.slice(0, 2), true);
  assert.equal(result.find(c => c.id === 'next')!.startTime, 2);
  assert.equal(result.find(c => c.id === 'other')!.startTime, 10);
  const overlap = [...clips, clip('overlap', 4, 8)];
  assert.equal(canRippleDelete(overlap, clips.slice(0, 2)), false);
  assert.equal(deleteClips(overlap, clips.slice(0, 2), true), overlap);
});
