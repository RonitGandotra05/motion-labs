import React from 'react';
import { EditorElement, ElementType, TransitionType, Transition } from '../../types';

interface PropertiesPanelProps {
    element: EditorElement | null;
    onUpdate: (id: string, updates: Partial<EditorElement>) => void;
    onDelete: (id: string) => void;
    onSplitAudio?: (id: string) => void;
    panelWidth?: number;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ element, onUpdate, onDelete, onSplitAudio, panelWidth }) => {
    if (!element) {
        return (
            <div className="bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-4 text-gray-500 text-sm flex flex-col items-center justify-center h-full transition-colors" style={{ width: panelWidth ? `${panelWidth}px` : '300px' }}>
                <span>No element selected</span>
            </div>
        );
    }

    const handleChange = (key: string, value: any) => {
        onUpdate(element.id, { props: { ...element.props, [key]: value } });
    };

    const handleGeometryChange = (key: keyof EditorElement, value: number) => {
        onUpdate(element.id, { [key]: value });
    };

    const isMedia = element.type === ElementType.VIDEO || element.type === ElementType.AUDIO;

    return (
        <div className="bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full overflow-y-auto transition-colors" style={{ width: panelWidth ? `${panelWidth}px` : '300px' }}>
            <div className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 font-semibold text-sm text-gray-700 dark:text-gray-200">
                Properties
            </div>

            <div className="p-4 space-y-6">
                {/* Basic Info */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-500 uppercase font-bold">Layer Name</label>
                    <input
                        type="text"
                        value={element.name}
                        onChange={(e) => onUpdate(element.id, { name: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>

                {/* Layer Order Controls */}
                {element.type !== ElementType.AUDIO && (
                    <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">Layer Order</label>
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
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white mt-1"
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
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white mt-1"
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
                                className="rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Mute Audio</span>
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

                        {/* Playback Speed - Video only */}
                        {element.type === ElementType.VIDEO && (
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
                    </div>
                )}

                {/* Geometry (Visual Only) - Now enabled for VIDEO too */}
                {element.type !== ElementType.AUDIO && (
                    <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">Transform</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">X (%)</span>
                                <input type="number" value={Math.round(element.x)} onChange={(e) => handleGeometryChange('x', Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Y (%)</span>
                                <input type="number" value={Math.round(element.y)} onChange={(e) => handleGeometryChange('y', Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">W (%)</span>
                                <input type="number" value={Math.round(element.width)} onChange={(e) => handleGeometryChange('width', Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">H (%)</span>
                                <input type="number" value={Math.round(element.height)} onChange={(e) => handleGeometryChange('height', Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Rotation (°)</span>
                                <input type="number" value={Math.round(element.rotation)} onChange={(e) => handleGeometryChange('rotation', Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                            </div>
                        </div>

                        {/* Position Presets */}
                        <div className="pt-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Position Presets</span>
                            <div className="grid grid-cols-3 gap-1 mt-1">
                                <button onClick={() => onUpdate(element.id, { x: 0, y: 0 })} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">↖ Top-L</button>
                                <button onClick={() => onUpdate(element.id, { x: 50 - element.width / 2, y: 0 })} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">↑ Top</button>
                                <button onClick={() => onUpdate(element.id, { x: 100 - element.width, y: 0 })} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">↗ Top-R</button>
                                <button onClick={() => onUpdate(element.id, { x: 0, y: 50 - element.height / 2 })} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">← Left</button>
                                <button onClick={() => onUpdate(element.id, { x: 50 - element.width / 2, y: 50 - element.height / 2 })} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded text-[10px] text-blue-600 dark:text-blue-400 font-medium">⊙ Center</button>
                                <button onClick={() => onUpdate(element.id, { x: 100 - element.width, y: 50 - element.height / 2 })} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">→ Right</button>
                                <button onClick={() => onUpdate(element.id, { x: 0, y: 100 - element.height })} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">↙ Bot-L</button>
                                <button onClick={() => onUpdate(element.id, { x: 50 - element.width / 2, y: 100 - element.height })} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">↓ Bottom</button>
                                <button onClick={() => onUpdate(element.id, { x: 100 - element.width, y: 100 - element.height })} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">↘ Bot-R</button>
                            </div>
                        </div>

                        {/* Fit to Frame */}
                        <button
                            onClick={() => onUpdate(element.id, { x: 0, y: 0, width: 100, height: 100 })}
                            className="w-full py-1.5 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900 hover:bg-green-200 dark:hover:bg-green-900 rounded text-xs transition flex items-center justify-center space-x-1"
                        >
                            <span>⛶</span>
                            <span>Fit to Frame (100%)</span>
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
                    </div>
                )}

                {/* Video Filters - DaVinci Style */}
                {(element.type === ElementType.VIDEO || element.type === ElementType.IMAGE) && (
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

                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Brightness ({Math.round((element.props.brightness ?? 1) * 100)}%)</span>
                            <input
                                type="range" min="0" max="2" step="0.05"
                                value={element.props.brightness ?? 1}
                                onChange={(e) => handleChange('brightness', Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                            />
                        </div>

                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Contrast ({Math.round((element.props.contrast ?? 1) * 100)}%)</span>
                            <input
                                type="range" min="0" max="2" step="0.05"
                                value={element.props.contrast ?? 1}
                                onChange={(e) => handleChange('contrast', Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                            />
                        </div>

                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Saturation ({Math.round((element.props.saturation ?? 1) * 100)}%)</span>
                            <input
                                type="range" min="0" max="2" step="0.05"
                                value={element.props.saturation ?? 1}
                                onChange={(e) => handleChange('saturation', Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                            />
                        </div>

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

                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Hue Rotate ({element.props.hueRotate ?? 0}°)</span>
                            <input
                                type="range" min="0" max="360" step="5"
                                value={element.props.hueRotate ?? 0}
                                onChange={(e) => handleChange('hueRotate', Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                            />
                        </div>

                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Blend Mode</span>
                            <select
                                value={element.props.blendMode ?? 'normal'}
                                onChange={(e) => handleChange('blendMode', e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white mt-1"
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
                                handleChange('brightness', 1);
                                handleChange('contrast', 1);
                                handleChange('saturation', 1);
                                handleChange('blur', 0);
                                handleChange('grayscale', 0);
                                handleChange('sepia', 0);
                                handleChange('hueRotate', 0);
                                handleChange('blendMode', 'normal');
                            }}
                            className="w-full py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 transition"
                        >
                            Reset Filters
                        </button>
                    </div>
                )}

                {/* Visual Styles for Text and Shapes */}
                {(element.type === ElementType.TEXT || element.type === ElementType.SHAPE || element.type === ElementType.AI_GENERATED) && (
                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold">Appearance</label>

                        {(element.type === ElementType.TEXT || element.type === ElementType.AI_GENERATED) && (
                            <div className="space-y-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Content</span>
                                <textarea
                                    value={element.props.text || ''}
                                    onChange={(e) => handleChange('text', e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-900 dark:text-white h-20"
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
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white mt-1"
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
                                    </select>
                                </div>

                                {/* Font Weight */}
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Font Weight</span>
                                    <select
                                        value={element.props.fontWeight || 400}
                                        onChange={(e) => handleChange('fontWeight', Number(e.target.value))}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white mt-1"
                                    >
                                        <option value={300}>Light (300)</option>
                                        <option value={400}>Regular (400)</option>
                                        <option value={500}>Medium (500)</option>
                                        <option value={600}>Semi Bold (600)</option>
                                        <option value={700}>Bold (700)</option>
                                        <option value={800}>Extra Bold (800)</option>
                                    </select>
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
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Letter Space</span>
                                        <input
                                            type="number" step="0.5" min="-5" max="20"
                                            value={element.props.letterSpacing ?? 0}
                                            onChange={(e) => handleChange('letterSpacing', Number(e.target.value))}
                                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Line Height</span>
                                        <input
                                            type="number" step="0.1" min="0.5" max="3"
                                            value={element.props.lineHeight ?? 1.2}
                                            onChange={(e) => handleChange('lineHeight', Number(e.target.value))}
                                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
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
                                <span className="text-xs text-gray-500 dark:text-gray-400">Radius</span>
                                <input
                                    type="number"
                                    value={element.props.borderRadius || 0}
                                    onChange={(e) => handleChange('borderRadius', Number(e.target.value))}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
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
                        className="w-full py-2 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-200 dark:hover:bg-red-900 rounded text-sm transition"
                    >
                        Delete Layer
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PropertiesPanel;