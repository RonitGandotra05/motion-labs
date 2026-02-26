import React from 'react';
import { EditorElement, ElementType } from '../../types';

interface ColorPanelProps {
    element: EditorElement | null;
    onUpdate: (id: string, updates: Partial<EditorElement>) => void;
    panelWidth?: number;
}

const ColorPanel: React.FC<ColorPanelProps> = ({ element, onUpdate, panelWidth }) => {
    if (!element) {
        return (
            <div className="bg-white dark:bg-gray-900 flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                <span>No element selected</span>
            </div>
        );
    }

    const handleChange = (key: string, value: any) => {
        onUpdate(element.id, { props: { ...element.props, [key]: value } });
    };

    const isMediaOrAdjustment = element.type === ElementType.VIDEO || element.type === ElementType.IMAGE || element.type === ElementType.ADJUSTMENT;

    if (!isMediaOrAdjustment) {
        return (
            <div className="bg-white dark:bg-gray-900 flex flex-col items-center justify-center h-full text-gray-500 text-sm text-center px-4">
                <span>Color grading is only available for Video, Image, and Adjustment Layers.</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="p-4 space-y-6">

                {/* LUT Presets */}
                <div className="space-y-3">
                    <label className="text-xs text-gray-500 uppercase font-bold">🎬 LUT Presets</label>
                    <div className="grid grid-cols-2 gap-1.5">
                        {([
                            { value: 'none', label: 'None', colors: ['#888', '#888'] },
                            { value: 'cinematic', label: 'Cinematic', colors: ['#3b5998', '#ff8c00'] },
                            { value: 'vintage', label: 'Vintage', colors: ['#d4a574', '#8b6914'] },
                            { value: 'cool', label: 'Cool', colors: ['#6dd5ed', '#2193b0'] },
                            { value: 'warm', label: 'Warm', colors: ['#ff9a56', '#f7971e'] },
                            { value: 'noir', label: 'Noir', colors: ['#232526', '#414345'] },
                            { value: 'teal-orange', label: 'Teal & Orange', colors: ['#008080', '#ff6347'] },
                            { value: 'bleach-bypass', label: 'Bleach', colors: ['#e0e0e0', '#a0a0a0'] }
                        ] as const).map((lut) => (
                            <button
                                key={lut.value}
                                onClick={() => handleChange('lutPreset', lut.value)}
                                className={`py-1.5 px-2 rounded text-[10px] font-medium border transition ${element.props.lutPreset === lut.value || (!element.props.lutPreset && lut.value === 'none') ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}
                                style={{
                                    background: lut.value === 'none' ? undefined : `linear-gradient(135deg, ${lut.colors[0]}, ${lut.colors[1]})`
                                }}
                            >
                                <span className={lut.value === 'none' ? 'text-gray-600 dark:text-gray-400' : 'text-white drop-shadow-sm'}>
                                    {lut.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color Wheels - DaVinci Style */}
                <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <label className="text-xs text-gray-500 uppercase font-bold">🎨 Primary Color Wheels</label>

                    {/* Lift (Shadows) */}
                    <div className="space-y-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Lift (Shadows)</span>
                        <div className="grid grid-cols-3 gap-1">
                            <div>
                                <span className="text-[10px] text-red-500 dark:text-red-400">R</span>
                                <input
                                    type="range" min="-1" max="1" step="0.05"
                                    value={element.props.liftR ?? 0}
                                    onChange={(e) => handleChange('liftR', Number(e.target.value))}
                                    className="w-full h-1.5 bg-red-200 dark:bg-red-900 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-green-500 dark:text-green-400">G</span>
                                <input
                                    type="range" min="-1" max="1" step="0.05"
                                    value={element.props.liftG ?? 0}
                                    onChange={(e) => handleChange('liftG', Number(e.target.value))}
                                    className="w-full h-1.5 bg-green-200 dark:bg-green-900 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-blue-500 dark:text-blue-400">B</span>
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
                    <div className="space-y-1 mt-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Gamma (Midtones)</span>
                        <div className="grid grid-cols-3 gap-1">
                            <div>
                                <span className="text-[10px] text-red-500 dark:text-red-400">R</span>
                                <input
                                    type="range" min="-1" max="1" step="0.05"
                                    value={element.props.gammaR ?? 0}
                                    onChange={(e) => handleChange('gammaR', Number(e.target.value))}
                                    className="w-full h-1.5 bg-red-200 dark:bg-red-900 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-green-500 dark:text-green-400">G</span>
                                <input
                                    type="range" min="-1" max="1" step="0.05"
                                    value={element.props.gammaG ?? 0}
                                    onChange={(e) => handleChange('gammaG', Number(e.target.value))}
                                    className="w-full h-1.5 bg-green-200 dark:bg-green-900 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-blue-500 dark:text-blue-400">B</span>
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
                    <div className="space-y-1 mt-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Gain (Highlights)</span>
                        <div className="grid grid-cols-3 gap-1">
                            <div>
                                <span className="text-[10px] text-red-500 dark:text-red-400">R</span>
                                <input
                                    type="range" min="-1" max="1" step="0.05"
                                    value={element.props.gainR ?? 0}
                                    onChange={(e) => handleChange('gainR', Number(e.target.value))}
                                    className="w-full h-1.5 bg-red-200 dark:bg-red-900 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-green-500 dark:text-green-400">G</span>
                                <input
                                    type="range" min="-1" max="1" step="0.05"
                                    value={element.props.gainG ?? 0}
                                    onChange={(e) => handleChange('gainG', Number(e.target.value))}
                                    className="w-full h-1.5 bg-green-200 dark:bg-green-900 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-blue-500 dark:text-blue-400">B</span>
                                <input
                                    type="range" min="-1" max="1" step="0.05"
                                    value={element.props.gainB ?? 0}
                                    onChange={(e) => handleChange('gainB', Number(e.target.value))}
                                    className="w-full h-1.5 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Adjustments */}
                <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <label className="text-xs text-gray-500 uppercase font-bold">🎚️ Adjustments</label>

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
                        <span className="text-xs text-gray-500 dark:text-gray-400">Hue Rotate ({element.props.hueRotate ?? 0}°)</span>
                        <input
                            type="range" min="0" max="360" step="5"
                            value={element.props.hueRotate ?? 0}
                            onChange={(e) => handleChange('hueRotate', Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                    <button
                        onClick={() => {
                            handleChange('liftR', null);
                            handleChange('liftG', null);
                            handleChange('liftB', null);
                            handleChange('gammaR', null);
                            handleChange('gammaG', null);
                            handleChange('gammaB', null);
                            handleChange('gainR', null);
                            handleChange('gainG', null);
                            handleChange('gainB', null);
                            handleChange('brightness', null);
                            handleChange('contrast', null);
                            handleChange('saturation', null);
                            handleChange('hueRotate', null);
                            handleChange('lutPreset', 'none');
                        }}
                        className="w-full py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 transition"
                    >
                        Reset All Color
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ColorPanel;
