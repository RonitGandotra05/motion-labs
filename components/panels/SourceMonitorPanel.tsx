import React, { useState, useRef, useEffect } from 'react';
import { ElementType } from '../../types';
import MonitorTransport from '../ui/MonitorTransport';

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

    const handleSeek = (time: number) => {
        const media = videoRef.current || audioRef.current;
        if (!media) return;
        media.currentTime = Math.max(0, Math.min(media.duration || 0, time));
        setCurrentTime(media.currentTime);
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

            <MonitorTransport
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                onSeek={handleSeek}
                onTogglePlay={togglePlay}
                disabled={!clip || isImage}
                stepAmount={1 / 30}
                leftControls={(
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
                )}
                rightControls={clip && onInsertToTimeline ? (
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => onInsertToTimeline(clip)}
                            className="pp-icon-btn h-6 w-6 border border-transparent text-pp-text-dim hover:bg-pp-light hover:text-white"
                            data-tip="Insert (,)"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 19V5M5 12h12" />
                            </svg>
                        </button>
                        <button
                            onClick={() => onInsertToTimeline(clip)}
                            className="pp-icon-btn h-6 w-6 border border-transparent text-pp-text-dim hover:bg-pp-light hover:text-white"
                            data-tip="Overwrite (.)"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 4h14v16H5z" />
                            </svg>
                        </button>
                    </div>
                ) : null}
            />
        </div>
    );
};

export default SourceMonitorPanel;
