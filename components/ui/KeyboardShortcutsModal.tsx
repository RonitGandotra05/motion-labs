import React from 'react';
import useDialog from './useDialog';

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
    const dialogRef = useDialog(isOpen, onClose);
    if (!isOpen) return null;

    const shortcuts = [
        {
            category: 'Playback', items: [
                { key: 'Space', action: 'Play / Pause' },
                { key: 'J', action: 'Jump back 5 seconds' },
                { key: 'K', action: 'Pause' },
                { key: 'L', action: 'Jump forward 5 seconds & play' },
                { key: 'Home', action: 'Go to start' },
                { key: 'End', action: 'Go to end' },
            ]
        },
        {
            category: 'Editing', items: [
                { key: 'S', action: 'Split clip at playhead' },
                { key: 'Delete', action: 'Delete selected' },
                { key: 'Ctrl / ⌘ + Z', action: 'Undo' },
                { key: 'Ctrl / ⌘ + Shift + Z', action: 'Redo' },
                { key: 'Ctrl / ⌘ + C', action: 'Copy' },
                { key: 'Ctrl / ⌘ + V', action: 'Paste' },
                { key: 'D', action: 'Duplicate' },
            ]
        },
        {
            category: 'Timeline', items: [
                { key: 'Ctrl / ⌘ + =', action: 'Zoom in' },
                { key: 'Ctrl / ⌘ + −', action: 'Zoom out' },
                { key: 'Shift+Drag', action: 'Disable snapping' },
                { key: 'Y', action: 'Choose slip tool' },
            ]
        },
        {
            category: 'View', items: [
                { key: 'Arrow keys', action: 'Nudge selected item' },
                { key: 'Escape', action: 'Close a dialog' },
                { key: '?', action: 'Show shortcuts' },
            ]
        },
    ];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                ref={dialogRef} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabIndex={-1}
                className="studio-dialog bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <span className="text-lg">⌨️</span>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close keyboard shortcuts"
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh] grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {shortcuts.map((section) => (
                        <div key={section.category}>
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">
                                {section.category}
                            </h3>
                            <div className="space-y-2">
                                {section.items.map((shortcut) => (
                                    <div key={shortcut.key} className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600 dark:text-gray-300">{shortcut.action}</span>
                                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-mono rounded border border-gray-200 dark:border-gray-700">
                                            {shortcut.key}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">?</kbd> anytime to show this dialog
                    </p>
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcutsModal;
