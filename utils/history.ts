import { EditorElement, Track, Marker } from '../types';

// State snapshot for undo/redo
export interface HistoryState {
    elements: EditorElement[];
    tracks: Track[];
    markers: Marker[];
}

const MAX_HISTORY_SIZE = 50;

class HistoryManager {
    private undoStack: HistoryState[] = [];
    private redoStack: HistoryState[] = [];
    private lastSavedState: string = '';

    // Save current state to history (call before making changes)
    push(state: HistoryState): void {
        const stateStr = JSON.stringify(state);

        // Don't save if state hasn't changed
        if (stateStr === this.lastSavedState) return;

        this.undoStack.push(JSON.parse(stateStr));
        this.redoStack = []; // Clear redo stack on new action
        this.lastSavedState = stateStr;

        // Limit stack size
        if (this.undoStack.length > MAX_HISTORY_SIZE) {
            this.undoStack.shift();
        }
    }

    // Undo: returns previous state
    undo(currentState: HistoryState): HistoryState | null {
        if (this.undoStack.length === 0) return null;

        const previousState = this.undoStack.pop()!;
        this.redoStack.push(JSON.parse(JSON.stringify(currentState)));
        this.lastSavedState = JSON.stringify(previousState);

        return previousState;
    }

    // Redo: returns next state
    redo(currentState: HistoryState): HistoryState | null {
        if (this.redoStack.length === 0) return null;

        const nextState = this.redoStack.pop()!;
        this.undoStack.push(JSON.parse(JSON.stringify(currentState)));
        this.lastSavedState = JSON.stringify(nextState);

        return nextState;
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
        this.lastSavedState = '';
    }
}

// Singleton instance
export const historyManager = new HistoryManager();
