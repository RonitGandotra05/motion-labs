import React, { useState, useEffect } from 'react';
import { Track, EditorElement, ElementType } from '../../types';

interface AudioMixerPanelProps {
    tracks: Track[];
    elements: EditorElement[];
    currentTime: number;
    isPlaying: boolean;
    onUpdateTrack: (id: number, updates: Partial<Track>) => void;
}

const AudioMixerPanel: React.FC<AudioMixerPanelProps> = ({
    tracks,
    elements,
    currentTime,
    isPlaying,
    onUpdateTrack
}) => {
    // Simple fake VU meters state
    const [meters, setMeters] = useState<Record<number, number>>({});

    useEffect(() => {
        let animationFrameId: number;
        let lastUpdate = 0;

        const updateMeters = (time: number) => {
            if (time - lastUpdate > 100) {
                const newMeters: Record<number, number> = {};
                tracks.forEach(track => {
                    let hasAudio = false;
                    let trackVol = track.volume ?? 1;

                    if (isPlaying) {
                        hasAudio = elements.some(el =>
                            el.trackId === track.id &&
                            (el.type === ElementType.AUDIO || el.type === ElementType.VIDEO) &&
                            currentTime >= el.startTime &&
                            currentTime <= el.startTime + el.duration &&
                            !el.props.isMuted
                        );
                    }

                    if (hasAudio && trackVol > 0) {
                        newMeters[track.id] = (Math.random() * 0.4 + 0.6) * trackVol;
                    } else {
                        newMeters[track.id] = 0;
                    }
                });
                setMeters(newMeters);
                lastUpdate = time;
            }
            if (isPlaying) {
                animationFrameId = requestAnimationFrame(updateMeters);
            } else {
                setMeters({});
            }
        };

        if (isPlaying) {
            animationFrameId = requestAnimationFrame(updateMeters);
        } else {
            setMeters({});
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, tracks, elements, currentTime]);

    // Master meter (sum of all tracks)
    const masterLevel: number = (Object.values(meters) as number[]).reduce((sum, v) => Math.max(sum, v), 0);

    // dB scale markings
    const dbMarks = [0, -6, -12, -18, -24, -36, -48];

    return (
        <div className="flex flex-col h-[calc(100%-24px)] bg-pp-darkest border-l border-black/50 w-[42px] flex-shrink-0 select-none font-pp-ui mt-6 relative z-10 box-border border-b border-r">
            {/* Header */}
            <div className="text-center py-1 bg-pp-dark border-b border-black/30">
                <span className="text-[9px] text-pp-text font-bold tracking-tighter">MIXER</span>
            </div>

            {/* VU Meter area */}
            <div className="flex-1 flex flex-col items-center justify-center px-1 py-1 relative h-full pt-4">
                {/* dB Scale */}
                <div className="absolute left-0.5 top-5 bottom-8 flex flex-col justify-between text-[8px] text-pp-text-dim text-right w-4 font-bold select-none cursor-default pb-[2px]">
                    {dbMarks.map(db => (
                        <span key={db} className="leading-none">{db}</span>
                    ))}
                </div>

                {/* Stereo Meter Bars */}
                <div className="flex gap-[2px] h-full justify-center ml-[20px] w-[14px] pb-5">
                    {/* Left channel */}
                    <div className="w-[6px] h-full bg-[#111] rounded-[1px] relative overflow-hidden border border-black/60 shadow-inner">
                        <div
                            className="absolute bottom-0 w-full transition-all duration-[50ms]"
                            style={{
                                height: `${masterLevel * 100}%`,
                                background: 'linear-gradient(to top, #00ff00 0%, #00ff00 70%, #ffeb3b 85%, #ff0000 100%)',
                                opacity: 0.9
                            }}
                        />
                        {/* Peak indicator */}
                        {masterLevel > 0.95 && (
                            <div className="absolute top-[1px] left-0 right-0 h-[2px] bg-red-500 rounded-[1px]" />
                        )}
                        {/* Tick marks overlay */}
                        <div className="absolute inset-0 flex flex-col justify-between opacity-20 pointer-events-none">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="w-full h-[1px] bg-black/50" />
                            ))}
                        </div>
                    </div>
                    {/* Right channel */}
                    <div className="w-[6px] h-full bg-[#111] rounded-[1px] relative overflow-hidden border border-black/60 shadow-inner">
                        <div
                            className="absolute bottom-0 w-full transition-all duration-[50ms] delay-[10ms]"
                            style={{
                                height: `${(masterLevel * 0.92 + (isPlaying ? 0.03 : 0)) * 100}%`,
                                background: 'linear-gradient(to top, #00ff00 0%, #00ff00 70%, #ffeb3b 85%, #ff0000 100%)',
                                opacity: 0.9
                            }}
                        />
                        {masterLevel * 0.92 > 0.95 && (
                            <div className="absolute top-[1px] left-0 right-0 h-[2px] bg-red-500 rounded-[1px]" />
                        )}
                        {/* Tick marks overlay */}
                        <div className="absolute inset-0 flex flex-col justify-between opacity-20 pointer-events-none">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="w-full h-[1px] bg-black/50" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* L/R Labels */}
            <div className="absolute bottom-1 w-full flex justify-center gap-[2px] ml-[8px]">
                <span className="text-[8px] text-pp-text-dim w-[6px] text-center font-bold">L</span>
                <span className="text-[8px] text-pp-text-dim w-[6px] text-center font-bold">R</span>
            </div>
        </div>
    );
};

export default AudioMixerPanel;
