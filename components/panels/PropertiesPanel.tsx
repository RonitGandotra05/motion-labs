import React from 'react';
import { EditorElement, ElementType, TransitionType, Transition } from '../../types';

interface PropertiesPanelProps {
    element: EditorElement | null;
    onUpdate: (id: string, updates: Partial<EditorElement>) => void;
    onDelete: (id: string) => void;
    onSplitAudio?: (id: string) => void;
    panelWidth?: number;
    frameAspectRatio?: string;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ element, onUpdate, onDelete, onSplitAudio, panelWidth, frameAspectRatio = '16:9' }) => {
    if (!element) {
        return (
            <div className="bg-pp-darkest border-l border-black/50 p-4 text-pp-text-dim text-[11px] flex flex-col items-center justify-center h-full transition-colors font-pp-ui" style={{ width: panelWidth ? `${panelWidth}px` : '300px' }}>
                <span>No selection</span>
            </div>
        );
    }

    const handleChange = (key: string, value: any) => {
        onUpdate(element.id, { props: { ...element.props, [key]: value } });
    };

    const handleGeometryChange = (key: keyof EditorElement, value: number) => {
        onUpdate(element.id, { [key]: value });
    };

    const resetToNativeAspectRatio = () => {
        const sourceAspectRatio = element.props.sourceAspectRatio;
        if (!sourceAspectRatio) return;

        const nextHeight = element.width / sourceAspectRatio;
        onUpdate(element.id, { height: nextHeight });
    };

    const parseAspectRatio = (ratio: string) => {
        const [width, height] = ratio.split(':').map(Number);
        if (!width || !height) return 16 / 9;
        return width / height;
    };

    const getFittedLayout = (sourceAspectRatio: number, targetAspectRatio: number) => {
        if (sourceAspectRatio >= targetAspectRatio) {
            const height = (targetAspectRatio / sourceAspectRatio) * 100;
            return {
                width: 100,
                height,
                x: 0,
                y: (100 - height) / 2
            };
        }

        const width = (sourceAspectRatio / targetAspectRatio) * 100;
        return {
            width,
            height: 100,
            x: (100 - width) / 2,
            y: 0
        };
    };

    const applyMediaFitMode = (mode: NonNullable<EditorElement['props']['mediaFitMode']>) => {
        const sourceAspectRatio = element.props.sourceAspectRatio;
        const props = {
            ...element.props,
            mediaFitMode: mode,
            mediaZoom: mode === 'set-to-frame' ? 1 : element.props.mediaZoom ?? 1
        };

        if (!sourceAspectRatio) {
            onUpdate(element.id, { props });
            return;
        }

        if (mode === 'fill' || mode === 'stretch') {
            onUpdate(element.id, {
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                props
            });
            return;
        }

        const layout = getFittedLayout(sourceAspectRatio, parseAspectRatio(frameAspectRatio));
        onUpdate(element.id, {
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height,
            props
        });
    };

    const isMedia = element.type === ElementType.VIDEO || element.type === ElementType.AUDIO;

    return (
        <div className="bg-pp-darkest border-l border-black/50 flex flex-col h-full overflow-y-auto custom-scrollbar transition-colors font-pp-ui select-none" style={{ width: panelWidth ? `${panelWidth}px` : '300px' }}>
            {/* Header Tabs Area */}
            <div className="flex bg-pp-dark border-b border-black/30 w-full overflow-hidden flex-shrink-0">
                <div className="pp-panel-tab active px-3 py-1 flex-1">
                    Effect Controls
                </div>
            </div>

            <div className="p-3 space-y-4 pb-12">
                {/* Basic Info */}
                <div className="space-y-1">
                    <label className="text-[11px] text-pp-text font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-blue-500"></span>
                        {element.name}
                    </label>
                    <input
                        type="text"
                        value={element.name}
                        onChange={(e) => onUpdate(element.id, { name: e.target.value })}
                        className="w-full bg-pp-dark border border-black/40 rounded-sm px-1.5 py-0.5 text-[11px] text-pp-text focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>

                {/* Clip Color Label */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-500 uppercase font-bold">🏷️ Clip Color</label>
                    <div className="flex gap-1 flex-wrap">
                        {(['none', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const).map((color) => (
                            <button
                                key={color}
                                onClick={() => onUpdate(element.id, { clipColor: color })}
                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${element.clipColor === color || (!element.clipColor && color === 'none')
                                    ? 'border-white dark:border-gray-300 ring-2 ring-blue-500'
                                    : 'border-transparent'
                                    }`}
                                style={{
                                    backgroundColor: color === 'none' ? 'transparent' : color === 'cyan' ? '#06b6d4' : color,
                                    backgroundImage: color === 'none' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : undefined,
                                    backgroundSize: color === 'none' ? '6px 6px' : undefined,
                                    backgroundPosition: color === 'none' ? '0 0, 0 3px, 3px -3px, -3px 0px' : undefined
                                }}
                                data-tip={color === 'none' ? 'No color' : color.charAt(0).toUpperCase() + color.slice(1)}
                            />
                        ))}
                    </div>
                </div>

                {/* Layer Order Controls */}
                {element.type !== ElementType.AUDIO && (
                    <div className="space-y-2 pt-3 border-t border-black/30">
                        <label className="text-[11px] text-pp-text font-semibold flex items-center gap-1">
                            ⬇ Layer Order
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onUpdate(element.id, { zIndex: (element.zIndex ?? 0) + 1 })}
                                className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 transition"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                                <span>Bring Up</span>
                            </button>
                            <button
                                onClick={() => onUpdate(element.id, { zIndex: Math.max(0, (element.zIndex ?? 0) - 1) })}
                                className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 transition"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                <span>Send Down</span>
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400">Current layer: {element.zIndex ?? 0}</p>
                    </div>
                )}

                {/* Transitions - DaVinci Style */}
                {element.type !== ElementType.AUDIO && (
                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">⚡ Transitions</label>

                        {/* Transition In */}
                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Transition In</span>
                            <select
                                value={element.transitionIn?.type ?? 'none'}
                                onChange={(e) => onUpdate(element.id, {
                                    transitionIn: {
                                        type: e.target.value as TransitionType,
                                        duration: element.transitionIn?.duration ?? 0.5
                                    }
                                })}
                                className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text mt-1"
                            >
                                <option value="none">None</option>
                                <option value="fade">Fade In</option>
                                <option value="dissolve">Dissolve</option>
                                <option value="wipe-left">Wipe Left</option>
                                <option value="wipe-right">Wipe Right</option>
                                <option value="wipe-up">Wipe Up</option>
                                <option value="wipe-down">Wipe Down</option>
                                <option value="zoom-in">Zoom In</option>
                                <option value="zoom-out">Zoom Out</option>
                            </select>
                            {element.transitionIn && element.transitionIn.type !== 'none' && (
                                <div className="mt-2">
                                    <span className="text-[10px] text-gray-400">Duration ({element.transitionIn.duration}s)</span>
                                    <input
                                        type="range" min="0.1" max="2" step="0.1"
                                        value={element.transitionIn.duration}
                                        onChange={(e) => onUpdate(element.id, {
                                            transitionIn: { ...element.transitionIn!, duration: Number(e.target.value) }
                                        })}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Transition Out */}
                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Transition Out</span>
                            <select
                                value={element.transitionOut?.type ?? 'none'}
                                onChange={(e) => onUpdate(element.id, {
                                    transitionOut: {
                                        type: e.target.value as TransitionType,
                                        duration: element.transitionOut?.duration ?? 0.5
                                    }
                                })}
                                className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text mt-1"
                            >
                                <option value="none">None</option>
                                <option value="fade">Fade Out</option>
                                <option value="dissolve">Dissolve</option>
                                <option value="wipe-left">Wipe Left</option>
                                <option value="wipe-right">Wipe Right</option>
                                <option value="wipe-up">Wipe Up</option>
                                <option value="wipe-down">Wipe Down</option>
                                <option value="zoom-in">Zoom In</option>
                                <option value="zoom-out">Zoom Out</option>
                            </select>
                            {element.transitionOut && element.transitionOut.type !== 'none' && (
                                <div className="mt-2">
                                    <span className="text-[10px] text-gray-400">Duration ({element.transitionOut.duration}s)</span>
                                    <input
                                        type="range" min="0.1" max="2" step="0.1"
                                        value={element.transitionOut.duration}
                                        onChange={(e) => onUpdate(element.id, {
                                            transitionOut: { ...element.transitionOut!, duration: Number(e.target.value) }
                                        })}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Media Controls (Video/Audio) */}
                {isMedia && (
                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">Audio Settings</label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={element.props.isMuted || false}
                                onChange={(e) => handleChange('isMuted', e.target.checked)}
                                className="rounded bg-pp-dark border-black/40 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-pp-text">Mute Audio</span>
                        </div>
                        {!element.props.isMuted && (
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Volume ({Math.round((element.props.volume ?? 1) * 100)}%)</span>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={element.props.volume ?? 1}
                                    onChange={(e) => handleChange('volume', Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                                />
                            </div>
                        )}

                        {/* Playback Speed - Video and Audio */}
                        {(element.type === ElementType.VIDEO || element.type === ElementType.AUDIO) && (
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Speed ({element.props.playbackRate ?? 1}x)</span>
                                <input
                                    type="range" min="0.25" max="4" step="0.25"
                                    value={element.props.playbackRate ?? 1}
                                    onChange={(e) => handleChange('playbackRate', Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                                />
                                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                    <span>0.25x</span>
                                    <span>1x</span>
                                    <span>2x</span>
                                    <span>4x</span>
                                </div>
                            </div>
                        )}

                        {/* Reverse Playback Toggle */}
                        {(element.type === ElementType.VIDEO || element.type === ElementType.AUDIO) && (
                            <button
                                onClick={() => handleChange('isReversed', !element.props.isReversed)}
                                className={`w-full py-1.5 border rounded-[2px] text-[10px] transition flex items-center justify-center space-x-1 ${element.props.isReversed ? 'bg-pp-accent text-white border-blue-800' : 'bg-pp-dark text-pp-text border-black/40 hover:bg-pp-medium'}`}
                            >
                                <span>⏪</span>
                                <span>Reverse Playback</span>
                            </button>
                        )}

                        {/* Split Audio button - only for VIDEO elements */}
                        {element.type === ElementType.VIDEO && onSplitAudio && (
                            <button
                                onClick={() => onSplitAudio(element.id)}
                                className="w-full py-2 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900 hover:bg-purple-200 dark:hover:bg-purple-900 rounded text-sm transition flex items-center justify-center space-x-2"
                            >
                                <span>🎵</span>
                                <span>Split Audio to New Layer</span>
                            </button>
                        )}

                        {/* Audio Ducking Controls */}
                        <div className="pt-2 pb-2 border-b border-gray-100 dark:border-gray-800 mb-2">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={element.props.ducking || false}
                                    onChange={(e) => handleChange('ducking', e.target.checked)}
                                    className="rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Audio Ducking (Voiceover)</span>
                            </label>
                            {element.props.ducking && (
                                <div className="mt-2 pl-4">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">Ducking Level ({Math.round((element.props.duckingThreshold ?? 0.2) * 100)}%)</span>
                                    <input
                                        type="range" min="0" max="1" step="0.05"
                                        value={element.props.duckingThreshold ?? 0.2}
                                        onChange={(e) => handleChange('duckingThreshold', Number(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                                        data-tip="Volume level of background tracks when this track is playing"
                                    />
                                    <p className="text-[9px] text-gray-400 mt-0.5">Background volume during this clip</p>
                                </div>
                            )}
                        </div>

                        {/* Audio Fade Controls */}
                        <div className="space-y-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Fade In ({element.props.fadeIn ?? 0}s)</span>
                            <input
                                type="range" min="0" max="5" step="0.1"
                                value={element.props.fadeIn ?? 0}
                                onChange={(e) => handleChange('fadeIn', Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="space-y-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Fade Out ({element.props.fadeOut ?? 0}s)</span>
                            <input
                                type="range" min="0" max="5" step="0.1"
                                value={element.props.fadeOut ?? 0}
                                onChange={(e) => handleChange('fadeOut', Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Preserve Pitch Toggle */}
                        <button
                            onClick={() => handleChange('preservePitch', !element.props.preservePitch)}
                            className={`w-full py-1.5 border rounded-[2px] text-[10px] transition flex items-center justify-center space-x-1 ${element.props.preservePitch ? 'bg-pp-accent text-white border-blue-800' : 'bg-pp-dark text-pp-text border-black/40 hover:bg-pp-medium'}`}
                        >
                            <span>🎵</span>
                            <span>Preserve Pitch</span>
                        </button>
                    </div>
                )}

                {/* Video-only Controls */}
                {element.type === ElementType.VIDEO && (
                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">🎬 Video Effects</label>

                        {/* Stabilization Toggle */}
                        <button
                            onClick={() => handleChange('isStabilized', !element.props.isStabilized)}
                            className={`w-full py-1.5 border rounded text-xs transition flex items-center justify-center space-x-1 ${element.props.isStabilized ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            <span>📷</span>
                            <span>Stabilization</span>
                        </button>

                        {/* Freeze Frame Toggle */}
                        <button
                            onClick={() => handleChange('isFreezeFrame', !element.props.isFreezeFrame)}
                            className={`w-full py-1.5 border rounded text-xs transition flex items-center justify-center space-x-1 ${element.props.isFreezeFrame ? 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            <span>❄️</span>
                            <span>Freeze Frame</span>
                        </button>
                    </div>
                )}

                {/* Geometry (Visual Only) */}
                {element.type !== ElementType.AUDIO && (
                    <div className="space-y-2 pt-3 border-t border-black/30">
                        <label className="flex items-center text-[11px] font-semibold text-pp-text uppercase">
                            <span className="w-3 inline-block transition-transform transform rotate-90 opacity-60">▶</span>
                            Motion
                        </label>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pl-3 border-l border-white/5 ml-1.5">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-pp-text-dim">Position X</span>
                                <input type="number" value={Math.round(element.x)} onChange={(e) => handleGeometryChange('x', Number(e.target.value))} className="w-16 bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text text-right focus:outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-pp-text-dim">Position Y</span>
                                <input type="number" value={Math.round(element.y)} onChange={(e) => handleGeometryChange('y', Number(e.target.value))} className="w-16 bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text text-right focus:outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-pp-text-dim">Width (%)</span>
                                <input type="number" value={Math.round(element.width)} onChange={(e) => handleGeometryChange('width', Number(e.target.value))} className="w-16 bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text text-right focus:outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-pp-text-dim">Height (%)</span>
                                <input type="number" value={Math.round(element.height)} onChange={(e) => handleGeometryChange('height', Number(e.target.value))} className="w-16 bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text text-right focus:outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex justify-between items-center col-span-2">
                                <span className="text-[10px] text-pp-text-dim">Rotation (°)</span>
                                <input type="number" value={Math.round(element.rotation)} onChange={(e) => handleGeometryChange('rotation', Number(e.target.value))} className="w-16 bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text text-right focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        {/* Position Presets */}
                        <div className="pt-2 pl-3 ml-1.5 border-l border-white/5">
                            <span className="text-[10px] text-pp-text-dim block mb-1">Align & Distribute</span>
                            <div className="grid grid-cols-3 gap-0.5">
                                <button onClick={() => onUpdate(element.id, { x: 0, y: 0 })} className="px-1 py-1 bg-pp-dark border border-black/30 hover:bg-pp-medium rounded-sm text-[10px] text-pp-text-dim text-center leading-none">↖</button>
                                <button onClick={() => onUpdate(element.id, { x: 50 - element.width / 2, y: 0 })} className="px-1 py-1 bg-pp-dark border border-black/30 hover:bg-pp-medium rounded-sm text-[10px] text-pp-text-dim text-center leading-none">↑</button>
                                <button onClick={() => onUpdate(element.id, { x: 100 - element.width, y: 0 })} className="px-1 py-1 bg-pp-dark border border-black/30 hover:bg-pp-medium rounded-sm text-[10px] text-pp-text-dim text-center leading-none">↗</button>
                                <button onClick={() => onUpdate(element.id, { x: 0, y: 50 - element.height / 2 })} className="px-1 py-1 bg-pp-dark border border-black/30 hover:bg-pp-medium rounded-sm text-[10px] text-pp-text-dim text-center leading-none">←</button>
                                <button onClick={() => onUpdate(element.id, { x: 50 - element.width / 2, y: 50 - element.height / 2 })} className="px-1 py-1 bg-blue-600 border border-blue-700 hover:bg-blue-500 rounded-sm text-[10px] text-white text-center leading-none">⊙</button>
                                <button onClick={() => onUpdate(element.id, { x: 100 - element.width, y: 50 - element.height / 2 })} className="px-1 py-1 bg-pp-dark border border-black/30 hover:bg-pp-medium rounded-sm text-[10px] text-pp-text-dim text-center leading-none">→</button>
                                <button onClick={() => onUpdate(element.id, { x: 0, y: 100 - element.height })} className="px-1 py-1 bg-pp-dark border border-black/30 hover:bg-pp-medium rounded-sm text-[10px] text-pp-text-dim text-center leading-none">↙</button>
                                <button onClick={() => onUpdate(element.id, { x: 50 - element.width / 2, y: 100 - element.height })} className="px-1 py-1 bg-pp-dark border border-black/30 hover:bg-pp-medium rounded-sm text-[10px] text-pp-text-dim text-center leading-none">↓</button>
                                <button onClick={() => onUpdate(element.id, { x: 100 - element.width, y: 100 - element.height })} className="px-1 py-1 bg-pp-dark border border-black/30 hover:bg-pp-medium rounded-sm text-[10px] text-pp-text-dim text-center leading-none">↘</button>
                            </div>
                        </div>

                        {/* Fit to Frame */}
                        {(element.type === ElementType.VIDEO || element.type === ElementType.IMAGE) ? (
                            <div className="space-y-2 pt-2 pl-3 ml-1.5 border-l border-white/5">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Frame Fit</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => applyMediaFitMode('fit')}
                                        className={`py-1.5 rounded border text-xs transition ${element.props.mediaFitMode !== 'fill' && element.props.mediaFitMode !== 'stretch' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                    >
                                        Fit
                                    </button>
                                    <button
                                        onClick={() => applyMediaFitMode('fill')}
                                        className={`py-1.5 rounded border text-xs transition ${element.props.mediaFitMode === 'fill' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                    >
                                        Fill
                                    </button>
                                    <button
                                        onClick={() => applyMediaFitMode('stretch')}
                                        className={`py-1.5 rounded border text-xs transition ${element.props.mediaFitMode === 'stretch' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                    >
                                        Stretch
                                    </button>
                                    <button
                                        onClick={() => applyMediaFitMode('set-to-frame')}
                                        className={`py-1.5 rounded border text-xs transition ${element.props.mediaFitMode === 'set-to-frame' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                    >
                                        Set to Frame
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => onUpdate(element.id, { x: 0, y: 0, width: 100, height: 100 })}
                                className="w-full py-1.5 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900 hover:bg-green-200 dark:hover:bg-green-900 rounded text-xs transition flex items-center justify-center space-x-1"
                            >
                                <span>⛶</span>
                                <span>Fit to Frame (100%)</span>
                            </button>
                        )}

                        {(element.type === ElementType.VIDEO || element.type === ElementType.IMAGE) && element.props.sourceAspectRatio && (
                            <button
                                onClick={resetToNativeAspectRatio}
                                className="w-full py-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-200 dark:hover:bg-indigo-900 rounded text-xs transition flex items-center justify-center space-x-1"
                            >
                                <span>▣</span>
                                <span>Reset to Native Ratio</span>
                            </button>
                        )}

                        {(element.type === ElementType.VIDEO || element.type === ElementType.IMAGE) && (
                            <div className="pt-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Media Zoom ({Math.round((element.props.mediaZoom ?? 1) * 100)}%)
                                </span>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="3"
                                    step="0.1"
                                    value={element.props.mediaZoom ?? 1}
                                    onChange={(e) => handleChange('mediaZoom', Number(e.target.value))}
                                    className="mt-1 w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        )}

                        {/* Lock Aspect Ratio */}
                        <button
                            onClick={() => onUpdate(element.id, { lockAspectRatio: !element.lockAspectRatio })}
                            className={`w-full py-1.5 border rounded text-xs transition flex items-center justify-center space-x-1 ${element.lockAspectRatio ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            <span>{element.lockAspectRatio ? '🔒' : '🔓'}</span>
                            <span>Lock Aspect Ratio</span>
                        </button>

                        {/* Flip Controls */}
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => onUpdate(element.id, { flipX: !element.flipX })}
                                className={`flex-1 py-1.5 border rounded text-xs transition flex items-center justify-center space-x-1 ${element.flipX ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            >
                                <span>↔</span>
                                <span>Flip H</span>
                            </button>
                            <button
                                onClick={() => onUpdate(element.id, { flipY: !element.flipY })}
                                className={`flex-1 py-1.5 border rounded text-xs transition flex items-center justify-center space-x-1 ${element.flipY ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            >
                                <span>↕</span>
                                <span>Flip V</span>
                            </button>
                        </div>

                        {/* Drop Shadow */}
                        <div className="pt-3">
                            <label className="text-xs text-gray-500 uppercase font-bold">🌓 Drop Shadow</label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                    <span className="text-[10px] text-gray-400">Color</span>
                                    <input
                                        type="color"
                                        value={element.props.shadowColor || '#000000'}
                                        onChange={(e) => handleChange('shadowColor', e.target.value)}
                                        className="w-full h-6 bg-transparent cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-400">Blur ({element.props.shadowBlur ?? 0}px)</span>
                                    <input
                                        type="range" min="0" max="50" step="1"
                                        value={element.props.shadowBlur ?? 0}
                                        onChange={(e) => handleChange('shadowBlur', Number(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-400">Offset X</span>
                                    <input
                                        type="number" step="1" min="-50" max="50"
                                        value={element.props.shadowX ?? 4}
                                        onChange={(e) => handleChange('shadowX', Number(e.target.value))}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-0.5 text-xs text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-400">Offset Y</span>
                                    <input
                                        type="number" step="1" min="-50" max="50"
                                        value={element.props.shadowY ?? 4}
                                        onChange={(e) => handleChange('shadowY', Number(e.target.value))}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-0.5 text-xs text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    handleChange('shadowColor', undefined);
                                    handleChange('shadowBlur', 0);
                                    handleChange('shadowX', 0);
                                    handleChange('shadowY', 0);
                                }}
                                className="w-full mt-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-500 transition"
                            >
                                Remove Shadow
                            </button>
                        </div>
                    </div>
                )}

                {/* Video Filters - DaVinci Style */}
                {(element.type === ElementType.VIDEO || element.type === ElementType.IMAGE || element.type === ElementType.ADJUSTMENT) && (
                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">🎨 Video Filters</label>

                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Opacity ({Math.round((element.props.opacity ?? 1) * 100)}%)</span>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={element.props.opacity ?? 1}
                                onChange={(e) => handleChange('opacity', Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                            />
                        </div>

                        {/* Color properties moved to ColorPanel */}

                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Blur ({element.props.blur ?? 0}px)</span>
                            <input
                                type="range" min="0" max="20" step="1"
                                value={element.props.blur ?? 0}
                                onChange={(e) => handleChange('blur', Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Grayscale</span>
                                <input
                                    type="range" min="0" max="1" step="0.1"
                                    value={element.props.grayscale ?? 0}
                                    onChange={(e) => handleChange('grayscale', Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                                />
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Sepia</span>
                                <input
                                    type="range" min="0" max="1" step="0.1"
                                    value={element.props.sepia ?? 0}
                                    onChange={(e) => handleChange('sepia', Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                                />
                            </div>
                        </div>

                        {/* hueRotate moved to ColorPanel */}

                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Blend Mode</span>
                            <select
                                value={element.props.blendMode ?? 'normal'}
                                onChange={(e) => handleChange('blendMode', e.target.value)}
                                className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text mt-1"
                            >
                                <option value="normal">Normal</option>
                                <option value="multiply">Multiply</option>
                                <option value="screen">Screen</option>
                                <option value="overlay">Overlay</option>
                                <option value="darken">Darken</option>
                                <option value="lighten">Lighten</option>
                                <option value="color-dodge">Color Dodge</option>
                                <option value="color-burn">Color Burn</option>
                                <option value="hard-light">Hard Light</option>
                                <option value="soft-light">Soft Light</option>
                                <option value="difference">Difference</option>
                                <option value="exclusion">Exclusion</option>
                            </select>
                        </div>

                        <button
                            onClick={() => {
                                handleChange('opacity', 1);
                                handleChange('blur', 0);
                                handleChange('grayscale', 0);
                                handleChange('sepia', 0);
                                handleChange('blendMode', 'normal');
                            }}
                            className="w-full py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 transition"
                        >
                            Reset Filters
                        </button>
                    </div>
                )}

                {/* Crop Controls */}
                {(element.type === ElementType.VIDEO || element.type === ElementType.IMAGE) && (
                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">✂️ Crop</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-[10px] text-gray-500">Left ({element.props.cropLeft ?? 0}%)</span>
                                <input
                                    type="range" min="0" max="50" step="1"
                                    value={element.props.cropLeft ?? 0}
                                    onChange={(e) => handleChange('cropLeft', Number(e.target.value))}
                                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500">Right ({element.props.cropRight ?? 0}%)</span>
                                <input
                                    type="range" min="0" max="50" step="1"
                                    value={element.props.cropRight ?? 0}
                                    onChange={(e) => handleChange('cropRight', Number(e.target.value))}
                                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500">Top ({element.props.cropTop ?? 0}%)</span>
                                <input
                                    type="range" min="0" max="50" step="1"
                                    value={element.props.cropTop ?? 0}
                                    onChange={(e) => handleChange('cropTop', Number(e.target.value))}
                                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500">Bottom ({element.props.cropBottom ?? 0}%)</span>
                                <input
                                    type="range" min="0" max="50" step="1"
                                    value={element.props.cropBottom ?? 0}
                                    onChange={(e) => handleChange('cropBottom', Number(e.target.value))}
                                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                handleChange('cropLeft', 0);
                                handleChange('cropRight', 0);
                                handleChange('cropTop', 0);
                                handleChange('cropBottom', 0);
                            }}
                            className="w-full py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 transition"
                        >
                            Reset Crop
                        </button>
                    </div>
                )}

                {/* LUT Presets moved to ColorPanel */}

                {/* Color Wheels - DaVinci Style */}
                {(element.type === ElementType.VIDEO || element.type === ElementType.IMAGE || element.type === ElementType.ADJUSTMENT) && (
                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">🎨 Color Wheels</label>

                        {/* Lift (Shadows) */}
                        <div className="space-y-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Lift (Shadows)</span>
                            <div className="grid grid-cols-3 gap-1">
                                <div>
                                    <span className="text-[10px] text-red-400">R</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.liftR ?? 0}
                                        onChange={(e) => handleChange('liftR', Number(e.target.value))}
                                        className="w-full h-1.5 bg-red-200 dark:bg-red-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-green-400">G</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.liftG ?? 0}
                                        onChange={(e) => handleChange('liftG', Number(e.target.value))}
                                        className="w-full h-1.5 bg-green-200 dark:bg-green-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-blue-400">B</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.liftB ?? 0}
                                        onChange={(e) => handleChange('liftB', Number(e.target.value))}
                                        className="w-full h-1.5 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Gamma (Midtones) */}
                        <div className="space-y-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Gamma (Midtones)</span>
                            <div className="grid grid-cols-3 gap-1">
                                <div>
                                    <span className="text-[10px] text-red-400">R</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gammaR ?? 0}
                                        onChange={(e) => handleChange('gammaR', Number(e.target.value))}
                                        className="w-full h-1.5 bg-red-200 dark:bg-red-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-green-400">G</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gammaG ?? 0}
                                        onChange={(e) => handleChange('gammaG', Number(e.target.value))}
                                        className="w-full h-1.5 bg-green-200 dark:bg-green-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-blue-400">B</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gammaB ?? 0}
                                        onChange={(e) => handleChange('gammaB', Number(e.target.value))}
                                        className="w-full h-1.5 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Gain (Highlights) */}
                        <div className="space-y-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Gain (Highlights)</span>
                            <div className="grid grid-cols-3 gap-1">
                                <div>
                                    <span className="text-[10px] text-red-400">R</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gainR ?? 0}
                                        onChange={(e) => handleChange('gainR', Number(e.target.value))}
                                        className="w-full h-1.5 bg-red-200 dark:bg-red-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-green-400">G</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gainG ?? 0}
                                        onChange={(e) => handleChange('gainG', Number(e.target.value))}
                                        className="w-full h-1.5 bg-green-200 dark:bg-green-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-blue-400">B</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gainB ?? 0}
                                        onChange={(e) => handleChange('gainB', Number(e.target.value))}
                                        className="w-full h-1.5 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Audio EQ */}
                        <div className="pt-2 pb-2 border-b border-gray-100 dark:border-gray-800 mb-2">
                            <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2">Audio Equalization</h4>

                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs text-gray-600 dark:text-gray-300">Low Pass (Treble Cut)</label>
                                        <span className="text-[10px] text-gray-500">{element.props.lowPassFrequency || 20000} Hz</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="500"
                                        max="20000"
                                        step="100"
                                        value={element.props.lowPassFrequency || 20000}
                                        onChange={(e) => handleChange('lowPassFrequency', parseInt(e.target.value))}
                                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs text-gray-600 dark:text-gray-300">High Pass (Bass Cut)</label>
                                        <span className="text-[10px] text-gray-500">{element.props.highPassFrequency || 0} Hz</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1000"
                                        step="10"
                                        value={element.props.highPassFrequency || 0}
                                        onChange={(e) => handleChange('highPassFrequency', parseInt(e.target.value))}
                                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                    />
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                handleChange('liftR', 0);
                                handleChange('liftG', 0);
                                handleChange('liftB', 0);
                                handleChange('gammaR', 0);
                                handleChange('gammaG', 0);
                                handleChange('gammaB', 0);
                                handleChange('gainR', 0);
                                handleChange('gainG', 0);
                                handleChange('gainB', 0);
                            }}
                            className="w-full py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 transition"
                        >
                            Reset Color Wheels
                        </button>
                    </div>
                )}

                {/* Visual Styles for Text and Shapes */}
                {(element.type === ElementType.TEXT || element.type === ElementType.SHAPE || element.type === ElementType.AI_GENERATED) && (
                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">Appearance</label>

                        {(element.type === ElementType.TEXT || element.type === ElementType.AI_GENERATED) && (
                            <div className="space-y-1">
                                <span className="text-[10px] text-pp-text-dim">Content</span>
                                <textarea
                                    value={element.props.text || ''}
                                    onChange={(e) => handleChange('text', e.target.value)}
                                    className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1.5 py-1 text-[11px] text-pp-text h-20 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        )}

                        {/* Font & Typography - Text elements */}
                        {element.type === ElementType.TEXT && (
                            <div className="space-y-3 pt-2">
                                <label className="text-xs text-gray-500 uppercase font-bold">🔤 Typography</label>

                                {/* Font Family */}
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Font Family</span>
                                    <select
                                        value={element.props.fontFamily || 'Inter'}
                                        onChange={(e) => handleChange('fontFamily', e.target.value)}
                                        className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text mt-1"
                                    >
                                        <option value="Inter">Inter</option>
                                        <option value="Roboto">Roboto</option>
                                        <option value="Open Sans">Open Sans</option>
                                        <option value="Montserrat">Montserrat</option>
                                        <option value="Poppins">Poppins</option>
                                        <option value="Lato">Lato</option>
                                        <option value="Playfair Display">Playfair Display</option>
                                        <option value="Oswald">Oswald</option>
                                        <option value="Raleway">Raleway</option>
                                        <option value="Ubuntu">Ubuntu</option>
                                        <option value="Georgia">Georgia</option>
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Arial">Arial</option>
                                        <option value="Verdana">Verdana</option>
                                        <option value="Merriweather">Merriweather</option>
                                        <option value="Nunito">Nunito</option>
                                        <option value="Work Sans">Work Sans</option>
                                        <option value="Fira Code">Fira Code (Monospace)</option>
                                    </select>
                                </div>

                                {/* Font Weight */}
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Font Weight</span>
                                    <select
                                        value={element.props.fontWeight || 400}
                                        onChange={(e) => handleChange('fontWeight', Number(e.target.value))}
                                        className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text mt-1"
                                    >
                                        <option value={300}>Light (300)</option>
                                        <option value={400}>Regular (400)</option>
                                        <option value={500}>Medium (500)</option>
                                        <option value={600}>Semi Bold (600)</option>
                                        <option value={700}>Bold (700)</option>
                                        <option value={800}>Extra Bold (800)</option>
                                    </select>
                                </div>

                                {/* Text Animation */}
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Animation (In)</span>
                                    <select
                                        value={element.props.textAnimation || 'none'}
                                        onChange={(e) => handleChange('textAnimation', e.target.value)}
                                        className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text mt-1"
                                    >
                                        <option value="none">None</option>
                                        <option value="typewriter">Typewriter</option>
                                        <option value="slide-up">Slide Up</option>
                                        <option value="fade-in">Fade In</option>
                                        <option value="scale-up">Scale Up</option>
                                        <option value="blur-in">Blur In</option>
                                    </select>
                                    {element.props.textAnimation && element.props.textAnimation !== 'none' && (
                                        <div className="mt-2">
                                            <span className="text-[10px] text-gray-400">Duration ({element.props.animationDuration ?? 1}s)</span>
                                            <input
                                                type="range" min="0.1" max="5" step="0.1"
                                                value={element.props.animationDuration ?? 1}
                                                onChange={(e) => handleChange('animationDuration', Number(e.target.value))}
                                                className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Text Alignment */}
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Text Align</span>
                                    <div className="flex gap-1 mt-1">
                                        {(['left', 'center', 'right'] as const).map((align) => (
                                            <button
                                                key={align}
                                                onClick={() => handleChange('textAlign', align)}
                                                className={`flex-1 py-1.5 border rounded text-xs transition ${element.props.textAlign === align ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                            >
                                                {align === 'left' ? '◀' : align === 'center' ? '⬛' : '▶'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Letter Spacing & Line Height */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-[10px] text-pp-text-dim">Letter Space</span>
                                        <input
                                            type="number" step="0.5" min="-5" max="20"
                                            value={element.props.letterSpacing ?? 0}
                                            onChange={(e) => handleChange('letterSpacing', Number(e.target.value))}
                                            className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-pp-text-dim">Line Height</span>
                                        <input
                                            type="number" step="0.1" min="0.5" max="3"
                                            value={element.props.lineHeight ?? 1.2}
                                            onChange={(e) => handleChange('lineHeight', Number(e.target.value))}
                                            className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text"
                                        />
                                    </div>
                                </div>

                                {/* Text Shadow */}
                                <div className="pt-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Text Shadow</span>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <div>
                                            <span className="text-[10px] text-gray-400">Color</span>
                                            <input
                                                type="color"
                                                value={element.props.textShadowColor || '#000000'}
                                                onChange={(e) => handleChange('textShadowColor', e.target.value)}
                                                className="w-full h-6 bg-transparent cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400">Blur ({element.props.textShadowBlur ?? 0}px)</span>
                                            <input
                                                type="range" min="0" max="20" step="1"
                                                value={element.props.textShadowBlur ?? 0}
                                                onChange={(e) => handleChange('textShadowBlur', Number(e.target.value))}
                                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400">Offset X</span>
                                            <input
                                                type="number" step="1" min="-20" max="20"
                                                value={element.props.textShadowX ?? 2}
                                                onChange={(e) => handleChange('textShadowX', Number(e.target.value))}
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-0.5 text-xs text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400">Offset Y</span>
                                            <input
                                                type="number" step="1" min="-20" max="20"
                                                value={element.props.textShadowY ?? 2}
                                                onChange={(e) => handleChange('textShadowY', Number(e.target.value))}
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-0.5 text-xs text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Text Color</span>
                                <input
                                    type="color"
                                    value={element.props.color?.startsWith('#') ? element.props.color : '#ffffff'}
                                    onChange={(e) => handleChange('color', e.target.value)}
                                    className="w-full h-8 bg-transparent cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Bg Color</span>
                                <input
                                    type="color"
                                    value={element.props.backgroundColor?.startsWith('#') ? element.props.backgroundColor : '#000000'}
                                    onChange={(e) => handleChange('backgroundColor', e.target.value)}
                                    className="w-full h-8 bg-transparent cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-[10px] text-pp-text-dim">Radius</span>
                                <input
                                    type="number"
                                    value={element.props.borderRadius || 0}
                                    onChange={(e) => handleChange('borderRadius', Number(e.target.value))}
                                    className="w-full bg-pp-dark border border-black/40 rounded-[2px] px-1 py-0.5 text-[10px] text-pp-text"
                                />
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Opacity</span>
                                <input
                                    type="range" min="0" max="1" step="0.1"
                                    value={element.props.opacity || 1}
                                    onChange={(e) => handleChange('opacity', Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-6 mt-auto">
                    <button
                        onClick={() => onDelete(element.id)}
                        className="w-full py-1.5 bg-red-900/30 text-red-500 border border-red-900/50 hover:bg-red-900/50 rounded-sm text-[11px] transition font-semibold"
                    >
                        Delete Layer (Backspace)
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PropertiesPanel;
