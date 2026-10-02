import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyManager } from '../utils/history.ts';
import type { HistoryState } from '../utils/history.ts';
const state = (name: string): HistoryState => ({ elements: [], tracks: [{ id: 0, name, type: 'video', isVisible: true, isLocked: false }], markers: [] });
test('editing after undo saves the restored state and clears the abandoned redo branch', () => {
  historyManager.clear();
  const a = state('A'), b = state('B'), c = state('C');
  historyManager.push(a);
  assert.deepEqual(historyManager.undo(b), a);
  historyManager.push(a);
  assert.equal(historyManager.canRedo(), false);
  assert.deepEqual(historyManager.undo(c), a);
});
test('editing after redo remains undoable', () => {
  historyManager.clear();
  const a = state('A'), b = state('B'), c = state('C');
  historyManager.push(a);
  historyManager.undo(b);
  assert.deepEqual(historyManager.redo(a), b);
  historyManager.push(b);
  assert.deepEqual(historyManager.undo(c), b);
});
