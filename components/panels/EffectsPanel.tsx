import React, { useState } from 'react';

interface EffectsPanelProps {
    onClose?: () => void;
}

interface EffectCategory {
    name: string;
    children?: EffectCategory[];
    isEffect?: boolean;
}

const effectsTree: EffectCategory[] = [
    {
        name: 'Video Transitions',
        children: [
            {
                name: 'Dissolve',
                children: [
                    { name: 'Additive Dissolve', isEffect: true },
                    { name: 'Cross Dissolve', isEffect: true },
                    { name: 'Dip to Black', isEffect: true },
                    { name: 'Dip to White', isEffect: true },
                    { name: 'Film Dissolve', isEffect: true },
                ]
            },
            {
                name: 'Iris',
                children: [
                    { name: 'Iris Cross', isEffect: true },
                    { name: 'Iris Diamond', isEffect: true },
                    { name: 'Iris Round', isEffect: true },
                ]
            },
            {
                name: 'Wipe',
                children: [
                    { name: 'Barn Doors', isEffect: true },
                    { name: 'Gradient Wipe', isEffect: true },
                    { name: 'Wipe', isEffect: true },
                ]
            },
            {
                name: 'Zoom',
                children: [
                    { name: 'Cross Zoom', isEffect: true },
                ]
            },
        ]
    },
    {
        name: 'Audio Transitions',
        children: [
            {
                name: 'Crossfade',
                children: [
                    { name: 'Constant Gain', isEffect: true },
                    { name: 'Constant Power', isEffect: true },
                    { name: 'Exponential Fade', isEffect: true },
                ]
            },
        ]
    },
    {
        name: 'Video Effects',
        children: [
            {
                name: 'Adjust',
                children: [
                    { name: 'Auto Color', isEffect: true },
                    { name: 'Auto Contrast', isEffect: true },
                    { name: 'Auto Levels', isEffect: true },
                    { name: 'Convolution Kernel', isEffect: true },
                    { name: 'Extract', isEffect: true },
                    { name: 'Levels', isEffect: true },
                    { name: 'Lighting Effects', isEffect: true },
                    { name: 'ProcAmp', isEffect: true },
                    { name: 'Shadow/Highlight', isEffect: true },
                ]
            },
            {
                name: 'Blur & Sharpen',
                children: [
                    { name: 'Camera Blur', isEffect: true },
                    { name: 'Directional Blur', isEffect: true },
                    { name: 'Fast Blur', isEffect: true },
                    { name: 'Gaussian Blur', isEffect: true },
                    { name: 'Sharpen', isEffect: true },
                    { name: 'Unsharp Mask', isEffect: true },
                ]
            },
            {
                name: 'Color Correction',
                children: [
                    { name: 'Brightness & Contrast', isEffect: true },
                    { name: 'Color Balance', isEffect: true },
                    { name: 'Lumetri Color', isEffect: true },
                    { name: 'RGB Curves', isEffect: true },
                    { name: 'Three-Way Color Corrector', isEffect: true },
                    { name: 'Tint', isEffect: true },
                ]
            },
            {
                name: 'Distort',
                children: [
                    { name: 'Corner Pin', isEffect: true },
                    { name: 'Lens Distortion', isEffect: true },
                    { name: 'Mirror', isEffect: true },
                    { name: 'Spherize', isEffect: true },
                    { name: 'Transform', isEffect: true },
                    { name: 'Turbulent Displace', isEffect: true },
                    { name: 'Warp Stabilizer', isEffect: true },
                ]
            },
            {
                name: 'Generate',
                children: [
                    { name: '4-Color Gradient', isEffect: true },
                    { name: 'Lens Flare', isEffect: true },
                    { name: 'Lightning', isEffect: true },
                ]
            },
            {
                name: 'Keying',
                children: [
                    { name: 'Chroma Key', isEffect: true },
                    { name: 'Color Key', isEffect: true },
                    { name: 'Luma Key', isEffect: true },
                    { name: 'Ultra Key', isEffect: true },
                ]
            },
            {
                name: 'Stylize',
                children: [
                    { name: 'Alpha Glow', isEffect: true },
                    { name: 'Brush Strokes', isEffect: true },
                    { name: 'Find Edges', isEffect: true },
                    { name: 'Mosaic', isEffect: true },
                    { name: 'Posterize', isEffect: true },
                    { name: 'Roughen Edges', isEffect: true },
                    { name: 'Strobe Light', isEffect: true },
                ]
            },
        ]
    },
    {
        name: 'Audio Effects',
        children: [
            {
                name: 'Amplitude and Compression',
                children: [
                    { name: 'Amplify', isEffect: true },
                    { name: 'Dynamics', isEffect: true },
                    { name: 'Hard Limiter', isEffect: true },
                    { name: 'Multiband Compressor', isEffect: true },
                    { name: 'Single-band Compressor', isEffect: true },
                    { name: 'Tube-modeled Compressor', isEffect: true },
                ]
            },
            {
                name: 'Delay and Echo',
                children: [
                    { name: 'Analog Delay', isEffect: true },
                    { name: 'Delay', isEffect: true },
                ]
            },
            {
                name: 'Filter and EQ',
                children: [
                    { name: 'Bass', isEffect: true },
                    { name: 'DeEsser', isEffect: true },
                    { name: 'Graphic Equalizer (10 Bands)', isEffect: true },
                    { name: 'Graphic Equalizer (20 Bands)', isEffect: true },
                    { name: 'Highpass', isEffect: true },
                    { name: 'Lowpass', isEffect: true },
                    { name: 'Notch Filter', isEffect: true },
                    { name: 'Parametric Equalizer', isEffect: true },
                    { name: 'Treble', isEffect: true },
                ]
            },
            {
                name: 'Noise Reduction/Restoration',
                children: [
                    { name: 'DeHummer', isEffect: true },
                    { name: 'DeNoise', isEffect: true },
                ]
            },
            {
                name: 'Reverb',
                children: [
                    { name: 'Convolution Reverb', isEffect: true },
                    { name: 'Studio Reverb', isEffect: true },
                    { name: 'Surround Reverb', isEffect: true },
                ]
            },
        ]
    },
];

const TreeNode: React.FC<{ node: EffectCategory; depth: number; searchTerm: string }> = ({ node, depth, searchTerm }) => {
    const [isExpanded, setIsExpanded] = useState(depth < 1);
    const hasChildren = node.children && node.children.length > 0;

    // Filter by search
    const matchesSearch = searchTerm === '' ||
        node.name.toLowerCase().includes(searchTerm.toLowerCase());

    const childrenMatch = node.children?.some(child =>
        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        child.children?.some(grandchild => grandchild.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (searchTerm && !matchesSearch && !childrenMatch) return null;

    const shouldExpand = searchTerm ? true : isExpanded;

    return (
        <div className="font-pp-ui">
            <div
                className={`flex items-center h-[24px] cursor-pointer hover:bg-pp-medium select-none text-[12px] group transition-colors ${node.isEffect ? 'text-pp-text-bright' : 'text-pp-text font-medium bg-pp-darkest/40'}`}
                style={{ paddingLeft: `${depth * 14 + (depth === 0 ? 8 : 4)}px` }}
                onClick={() => {
                    if (hasChildren) setIsExpanded(!isExpanded);
                }}
                draggable={node.isEffect}
                onDragStart={(e) => {
                    if (node.isEffect) {
                        e.dataTransfer.setData('text/plain', node.name);
                    }
                }}
            >
                {/* Arrow Icon */}
                <div className={`w-4 h-4 flex items-center justify-center mr-1 ${!hasChildren ? 'invisible' : ''} text-pp-text-dim group-hover:text-pp-text transition-colors`}>
                    <svg
                        width="8" height="8" viewBox="0 0 10 10" fill="currentColor"
                        className={`transition-transform duration-100 ${shouldExpand ? 'rotate-90' : ''}`}
                    >
                        <path d="M2.5 1l5 4-5 4z" />
                    </svg>
                </div>

                {/* FX Icon or Folder */}
                {node.isEffect ? (
                    <div className="w-4 h-4 flex items-center justify-center mr-1.5 bg-pp-darkest border border-black/40 rounded-[2px]">
                        <span className="text-pp-accent text-[8px] font-bold tracking-tighter leading-none">fx</span>
                    </div>
                ) : (
                    <div className="w-4 h-4 flex items-center justify-center mr-1.5 text-pp-text-dim">
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
                            <path d="M1 2V8C1 8.55228 1.44772 9 2 9H10C10.5523 9 11 8.55228 11 8V3.5C11 2.94772 10.5523 2.5 10 2.5H5.5L4.5 1.5H2C1.44772 1.5 1 1.94772 1 2Z" fill="currentColor" fillOpacity="0.8" />
                        </svg>
                    </div>
                )}
                <span className="truncate">{node.name}</span>
            </div>
            {hasChildren && shouldExpand && (
                <div className="relative">
                    {/* Optional: Add vertical line for hierarchy guide here if needed */}
                    {node.children!.map((child, idx) => (
                        <TreeNode key={idx} node={child} depth={depth + 1} searchTerm={searchTerm} />
                    ))}
                </div>
            )}
        </div>
    );
};

const EffectsPanel: React.FC<EffectsPanelProps> = () => {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="flex flex-col h-full bg-pp-dark text-pp-text font-pp-ui custom-scrollbar border-l border-black/50 select-none overflow-hidden">
            {/* Header Tabs Area */}
            <div className="flex bg-pp-dark border-b border-black/30 w-full overflow-hidden flex-shrink-0">
                <div className="pp-panel-tab active px-3 py-1 flex-1">
                    Effects
                </div>
            </div>

            {/* Search bar */}
            <div className="px-2 py-1.5 border-b border-black/30 bg-pp-medium flex items-center">
                <svg className="w-3 h-3 text-pp-text-dim mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none text-[11px] text-pp-text placeholder-pp-text-dim/50 focus:outline-none w-full"
                />
            </div>

            {/* Effects tree */}
            <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar">
                {effectsTree.map((category, idx) => (
                    <TreeNode key={idx} node={category} depth={0} searchTerm={searchTerm} />
                ))}
            </div>
        </div>
    );
};

export default EffectsPanel;
