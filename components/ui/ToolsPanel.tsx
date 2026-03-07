import React from 'react';
import { MousePointerIcon, ScissorsIcon, SlipIcon, RollIcon, TypeIcon, ZoomInIcon } from './Icons';

export type ToolMode = 'pointer' | 'blade' | 'slip' | 'roll' | 'hand' | 'zoom' | 'type' |
    'track-select' | 'ripple-edit' | 'rate-stretch' | 'pen' | 'slide';

interface ToolsPanelProps {
    activeTool: string;
    onToolChange: (tool: ToolMode) => void;
}

// Rate Stretch icon
const RateStretchIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4 12h16" />
        <path d="M8 8l-4 4 4 4" />
        <path d="M16 8l4 4-4 4" />
    </svg>
);

// Pen icon  
const PenToolIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
    </svg>
);

// Hand/Pan icon
const HandIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 13" />
    </svg>
);

// Track Select icon
const TrackSelectIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="M17 17h5" />
        <path d="M19 15l2 2-2 2" />
    </svg>
);

// Slide icon
const SlideIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="6" y="4" width="12" height="16" rx="1" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="M3 9l-1 3 1 3" />
        <path d="M21 9l1 3-1 3" />
    </svg>
);

// Ripple Edit icon
const RippleEditIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="4" width="7" height="16" rx="1" />
        <rect x="14" y="4" width="7" height="16" rx="1" />
        <path d="M10 12h4" />
        <path d="M12 10l2 2-2 2" />
    </svg>
);

const tools: { id: ToolMode; label: string; shortcut: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'pointer', label: 'Selection Tool', shortcut: 'V', icon: MousePointerIcon },
    { id: 'track-select', label: 'Track Select Forward', shortcut: 'A', icon: TrackSelectIcon },
    { id: 'ripple-edit', label: 'Ripple Edit Tool', shortcut: 'B', icon: RippleEditIcon },
    { id: 'blade', label: 'Razor Tool', shortcut: 'C', icon: ScissorsIcon },
    { id: 'slip', label: 'Slip Tool', shortcut: 'Y', icon: SlipIcon },
    { id: 'pen', label: 'Pen Tool', shortcut: 'P', icon: PenToolIcon },
    { id: 'hand', label: 'Hand Tool', shortcut: 'H', icon: HandIcon },
    { id: 'zoom', label: 'Zoom Tool', shortcut: 'Z', icon: ZoomInIcon },
    { id: 'type', label: 'Type Tool', shortcut: 'T', icon: TypeIcon },
];

const ToolsPanel: React.FC<ToolsPanelProps> = ({ activeTool, onToolChange }) => {
    return (
        <div className="flex flex-col items-center w-[32px] bg-pp-dark py-1 flex-shrink-0">
            {tools.map((tool, index) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                    <React.Fragment key={tool.id}>
                        <button
                            className={`pp-icon-btn w-[26px] h-[26px] my-[1px] ${isActive ? 'active' : ''}`}
                            onClick={() => onToolChange(tool.id)}
                            data-tip={`${tool.label} (${tool.shortcut})`}
                        >
                            <Icon className="w-[14px] h-[14px]" />
                        </button>
                        {/* Separator after Razor tool to match Premiere Pro */}
                        {index === 5 && <div className="w-4 h-px bg-pp-border my-1" />}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default ToolsPanel;
