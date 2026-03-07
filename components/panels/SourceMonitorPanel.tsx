import React, { useState, useRef, useEffect } from 'react';
import { ElementType } from '../../types';

export interface SourceClip {
    name: string;
    type: ElementType;
    src: string;
    assetId?: string;
}

interface SourceMonitorPanelProps {
    clip?: SourceClip | null;
    onInsertToTimeline?: (clip: SourceClip) => void;
}

const SourceMonitorPanel: React.FC<SourceMonitorPanelProps> = ({ clip, onInsertToTimeline }) => {
    const [monitorZoom, setMonitorZoom] = useState<'fit' | 50 | 100 | 200>('fit');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Reset state when clip changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
    }, [clip?.src]);

    const togglePlay = () => {
        const media = videoRef.current || audioRef.current;
        if (!media) return;
        if (isPlaying) {
            media.pause();
        } else {
            media.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        const media = videoRef.current || audioRef.current;
        if (media) setCurrentTime(media.currentTime);
    };

    const handleLoadedMetadata = () => {
        const media = videoRef.current || audioRef.current;
        if (media) setDuration(media.duration);
    };

    const handleEnded = () => {
        setIsPlaying(false);
    };

    const stepFrame = (dir: number) => {
        const media = videoRef.current || audioRef.current;
        if (media) {
            media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + dir * (1 / 30)));
            setCurrentTime(media.currentTime);
        }
    };

    const formatTC = (t: number) => {
        if (!t || isNaN(t)) return '00:00:00:00';
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);
        const f = Math.floor((t % 1) * 30);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
    };

    const isVideo = clip?.type === ElementType.VIDEO;
    const isAudio = clip?.type === ElementType.AUDIO;
    const isImage = clip?.type === ElementType.IMAGE;

    return (
        <div className="relative flex flex-1 flex-col overflow-hidden bg-pp-darkest transition-colors h-full w-full">
            {/* Preview area */}
            <div className="flex flex-1 w-full items-center justify-center overflow-hidden p-4 min-h-0">
                {!clip ? (
                    <div className="relative bg-black overflow-hidden flex flex-col items-center justify-center text-pp-text-dim/40 text-[11px]"
                        style={{ width: '80%', aspectRatio: '16/9', maxHeight: '100%' }}
                    >
                        (no clip selected)
                    </div>
                ) : isVideo ? (
                    <video
                        ref={videoRef}
                        src={clip.src}
                        className="max-w-full max-h-full bg-black"
                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={handleEnded}
                        playsInline
                    />
                ) : isAudio ? (
                    <div className="flex flex-col items-center justify-center bg-black text-pp-text-dim"
                        style={{ width: '80%', aspectRatio: '16/9', maxHeight: '100%' }}
                    >
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 text-gray-500">
                            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                        </svg>
                        <span className="text-[11px] text-gray-400">{clip.name}</span>
                        <audio
                            ref={audioRef}
                            src={clip.src}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={handleEnded}
                        />
                    </div>
                ) : isImage ? (
                    <img src={clip.src} className="max-w-full max-h-full object-contain" alt={clip.name} />
                ) : (
                    <div className="text-pp-text-dim text-[11px]">Unsupported format</div>
                )}
            </div>

            {/* Source Monitor Toolbar */}
            <div className="flex-shrink-0 h-[36px] bg-pp-dark w-full border-t border-black/30 flex items-center px-4 justify-between relative">
                {/* Left: Timecode and Fit */}
                <div className="flex items-center space-x-4">
                    <span className="pp-timecode text-pp-timecode text-[12px] font-mono">
                        {formatTC(currentTime)}
                    </span>

                    <select
                        value={monitorZoom}
                        onChange={(e) => setMonitorZoom(e.target.value as any)}
                        className="bg-pp-dark border border-pp-border rounded px-2 py-0.5 text-[11px] text-pp-text outline-none cursor-pointer"
                    >
                        <option value="fit" className="bg-pp-menu-bg">Fit</option>
                        <option value="50" className="bg-pp-menu-bg">50%</option>
                        <option value="100" className="bg-pp-menu-bg">100%</option>
                        <option value="200" className="bg-pp-menu-bg">200%</option>
                    </select>
                </div>

                {/* Center: Transport Controls */}
                <div className="flex items-center space-x-1 absolute left-1/2 -translate-x-1/2">
                    <button className="pp-transport-btn" data-tip="Mark In" onClick={() => { }}>
                        <span className="text-[10px]">{`{`}</span>
                    </button>
                    <button className="pp-transport-btn" data-tip="Step Back 1 Frame" onClick={() => stepFrame(-1)}>
                        <span className="text-[10px]">◀</span>
                    </button>
                    <button
                        className="pp-transport-btn w-8 h-8 mx-1"
                        data-tip={isPlaying ? "Stop" : "Play"}
                        onClick={togglePlay}
                        disabled={!clip || isImage}
                    >
                        {isPlaying ? <span className="text-[12px]">⏸</span> : <span className="text-[14px]">▶</span>}
                    </button>
                    <button className="pp-transport-btn" data-tip="Step Forward 1 Frame" onClick={() => stepFrame(1)}>
                        <span className="text-[10px]">▶</span>
                    </button>
                    <button className="pp-transport-btn" data-tip="Mark Out" onClick={() => { }}>
                        <span className="text-[10px]">{`}`}</span>
                    </button>
                </div>

                {/* Right: Insert + Overwrite */}
                <div className="flex items-center space-x-2">
                    {clip && onInsertToTimeline && (
                        <>
                            <button
                                onClick={() => onInsertToTimeline(clip)}
                                className="pp-icon-btn w-6 h-6 border border-transparent text-pp-text-dim hover:text-white hover:bg-pp-light"
                                data-tip="Insert (,)"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 19V5M5 12h12" />
                                </svg>
                            </button>
                            <button
                                onClick={() => onInsertToTimeline(clip)}
                                className="pp-icon-btn w-6 h-6 border border-transparent text-pp-text-dim hover:text-white hover:bg-pp-light"
                                data-tip="Overwrite (.)"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 4h14v16H5z" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SourceMonitorPanel;
