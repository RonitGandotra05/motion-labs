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
            <div className="bg-pp-darkest border-l border-black/50 p-4 text-pp-text-dim text-[11px] flex flex-col items-center justify-center h-full transition-colors font-pp-ui" style={{ width: panelWidth ? `${panelWidth}px` : '300px' }}>
                <span>No selection</span>
            </div>
        );
    }

    const handleChange = (key: string, value: any) => {
        onUpdate(element.id, { props: { ...element.props, [key]: value } });
    };

    const isMediaOrAdjustment = element.type === ElementType.VIDEO || element.type === ElementType.IMAGE || element.type === ElementType.ADJUSTMENT;

    if (!isMediaOrAdjustment) {
        return (
            <div className="bg-pp-darkest border-l border-black/50 p-4 text-pp-text-dim text-[11px] flex flex-col items-center justify-center h-full transition-colors font-pp-ui text-center px-4" style={{ width: panelWidth ? `${panelWidth}px` : '300px' }}>
                <span>Lumetri Color is only available for Video, Image, and Adjustment Layers.</span>
            </div>
        );
    }

    return (
        <div className="bg-pp-darkest border-l border-black/50 flex flex-col h-full overflow-y-auto custom-scrollbar transition-colors font-pp-ui select-none" style={{ width: panelWidth ? `${panelWidth}px` : '300px' }}>
            {/* Header Tabs Area */}
            <div className="flex bg-pp-dark border-b border-black/30 w-full overflow-hidden flex-shrink-0">
                <div className="pp-panel-tab active px-3 py-1 flex-1">
                    Lumetri Color
                </div>
            </div>

            <div className="p-3 space-y-4 pb-12">

                {/* LUT Presets */}
                <div className="space-y-2">
                    <label className="flex items-center text-[11px] font-semibold text-pp-text uppercase">
                        <span className="w-3 inline-block transition-transform transform rotate-90 opacity-60">▶</span>
                        Creative
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 pl-3 border-l border-white/5 ml-1.5 mt-1">
                        {([
                            { value: 'none', label: 'None', colors: ['#555', '#555'] },
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
                                className={`py-1 px-1.5 rounded-[2px] text-[9px] font-medium border transition ${element.props.lutPreset === lut.value || (!element.props.lutPreset && lut.value === 'none') ? 'border-blue-500 ring-1 ring-blue-500' : 'border-black/40 hover:border-black/60'}`}
                                style={{
                                    background: lut.value === 'none' ? '#222' : `linear-gradient(135deg, ${lut.colors[0]}, ${lut.colors[1]})`
                                }}
                            >
                                <span className={lut.value === 'none' ? 'text-pp-text-dim' : 'text-white drop-shadow-sm'}>
                                    {lut.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color Wheels - DaVinci Style */}
                {/* Color Wheels - DaVinci Style */}
                <div className="space-y-2 pt-3 border-t border-black/30">
                    <label className="flex items-center text-[11px] font-semibold text-pp-text uppercase">
                        <span className="w-3 inline-block transition-transform transform rotate-90 opacity-60">▶</span>
                        Color Wheels & Match
                    </label>

                    <div className="pl-3 border-l border-white/5 ml-1.5 mt-1 space-y-3">
                        {/* Lift (Shadows) */}
                        <div className="space-y-1">
                            <span className="text-[10px] text-pp-text-dim">Shadows</span>
                            <div className="grid grid-cols-3 gap-1">
                                <div>
                                    <span className="text-[9px] text-red-500">R</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.liftR ?? 0}
                                        onChange={(e) => handleChange('liftR', Number(e.target.value))}
                                        className="w-full h-1 bg-red-900/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[9px] text-green-500">G</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.liftG ?? 0}
                                        onChange={(e) => handleChange('liftG', Number(e.target.value))}
                                        className="w-full h-1 bg-green-900/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[9px] text-blue-500">B</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.liftB ?? 0}
                                        onChange={(e) => handleChange('liftB', Number(e.target.value))}
                                        className="w-full h-1 bg-blue-900/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Gamma (Midtones) */}
                        <div className="space-y-1 mt-2">
                            <span className="text-[10px] text-pp-text-dim">Midtones</span>
                            <div className="grid grid-cols-3 gap-1">
                                <div>
                                    <span className="text-[9px] text-red-500">R</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gammaR ?? 0}
                                        onChange={(e) => handleChange('gammaR', Number(e.target.value))}
                                        className="w-full h-1 bg-red-900/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[9px] text-green-500">G</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gammaG ?? 0}
                                        onChange={(e) => handleChange('gammaG', Number(e.target.value))}
                                        className="w-full h-1 bg-green-900/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[9px] text-blue-500">B</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gammaB ?? 0}
                                        onChange={(e) => handleChange('gammaB', Number(e.target.value))}
                                        className="w-full h-1 bg-blue-900/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Gain (Highlights) */}
                        <div className="space-y-1 mt-2">
                            <span className="text-[10px] text-pp-text-dim">Highlights</span>
                            <div className="grid grid-cols-3 gap-1">
                                <div>
                                    <span className="text-[9px] text-red-500">R</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gainR ?? 0}
                                        onChange={(e) => handleChange('gainR', Number(e.target.value))}
                                        className="w-full h-1 bg-red-900/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[9px] text-green-500">G</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gainG ?? 0}
                                        onChange={(e) => handleChange('gainG', Number(e.target.value))}
                                        className="w-full h-1 bg-green-900/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[9px] text-blue-500">B</span>
                                    <input
                                        type="range" min="-1" max="1" step="0.05"
                                        value={element.props.gainB ?? 0}
                                        onChange={(e) => handleChange('gainB', Number(e.target.value))}
                                        className="w-full h-1 bg-blue-900/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Adjustments */}
                {/* Adjustments */}
                <div className="space-y-2 pt-3 border-t border-black/30">
                    <label className="flex items-center text-[11px] font-semibold text-pp-text uppercase">
                        <span className="w-3 inline-block transition-transform transform rotate-90 opacity-60">▶</span>
                        Basic Correction
                    </label>

                    <div className="pl-3 border-l border-white/5 ml-1.5 mt-1 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-pp-text-dim w-16">Exposure</span>
                            <input
                                type="range" min="0" max="2" step="0.05"
                                value={element.props.brightness ?? 1}
                                onChange={(e) => handleChange('brightness', Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 mx-2 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-[9px] text-pp-text w-6 text-right">{Math.round((element.props.brightness ?? 1) * 100)}%</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-pp-text-dim w-16">Contrast</span>
                            <input
                                type="range" min="0" max="2" step="0.05"
                                value={element.props.contrast ?? 1}
                                onChange={(e) => handleChange('contrast', Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 mx-2 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-[9px] text-pp-text w-6 text-right">{Math.round((element.props.contrast ?? 1) * 100)}%</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-pp-text-dim w-16">Saturation</span>
                            <input
                                type="range" min="0" max="2" step="0.05"
                                value={element.props.saturation ?? 1}
                                onChange={(e) => handleChange('saturation', Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 mx-2 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-[9px] text-pp-text w-6 text-right">{Math.round((element.props.saturation ?? 1) * 100)}%</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-pp-text-dim w-16">Hue Rotate</span>
                            <input
                                type="range" min="0" max="360" step="5"
                                value={element.props.hueRotate ?? 0}
                                onChange={(e) => handleChange('hueRotate', Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 mx-2 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-[9px] text-pp-text w-6 text-right">{element.props.hueRotate ?? 0}°</span>
                        </div>
                    </div>
                </div>

                <div className="pt-4 mt-auto">
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
                        className="w-full py-1.5 bg-pp-dark text-pp-text-dim border border-black/40 hover:bg-pp-medium hover:text-pp-text rounded-[2px] text-[10px] transition font-semibold"
                    >
                        Reset Effect
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ColorPanel;
