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
            if (time - lastUpdate > 100) { // Update ~10 times a sec
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
                        // Random meter value simulating audio RMS based on current track volume
                        newMeters[track.id] = (Math.random() * 0.4 + 0.6) * trackVol;
                    } else {
                        newMeters[track.id] = 0; // Decay instantly to 0 for simplicity
                    }
                });

                setMeters(newMeters);
                lastUpdate = time;
            }
            if (isPlaying) {
                animationFrameId = requestAnimationFrame(updateMeters);
            } else {
                setMeters({}); // Clear meters when paused
            }
        };

        if (isPlaying) {
            animationFrameId = requestAnimationFrame(updateMeters);
        } else {
            setMeters({});
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, tracks, elements, currentTime]);

    return (
        <div className="flex w-full h-full bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-4 space-x-4 overflow-x-auto custom-scrollbar">
            {tracks.length === 0 && (
                <div className="text-sm text-gray-500 w-full text-center mt-10">No layers to mix.</div>
            )}

            {tracks.map(track => {
                // Find if this track naturally contains audio
                const hasAudioElements = elements.some(e => e.trackId === track.id && (e.type === ElementType.AUDIO || e.type === ElementType.VIDEO));
                const vol = track.volume ?? 1;
                const pan = track.pan ?? 0;
                const meterVal = meters[track.id] || 0;

                return (
                    <div key={track.id} className="flex flex-col items-center flex-shrink-0 w-20 bg-white dark:bg-gray-800 rounded shadow border border-gray-200 dark:border-gray-700 py-3">
                        {/* Track Name */}
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 truncate w-full text-center px-1" title={track.name}>
                            {track.name}
                        </div>

                        {/* Pan Knob (simplified to slider for now) */}
                        <div className="flex flex-col items-center w-full mb-4 px-2">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Pan {pan > 0 ? 'R' : pan < 0 ? 'L' : 'C'}</span>
                            <input
                                type="range" min="-1" max="1" step="0.1"
                                value={pan}
                                onChange={(e) => onUpdateTrack(track.id, { pan: Number(e.target.value) })}
                                className="w-full h-1 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Volume Fader and VU Meter Area */}
                        <div className="relative flex justify-center h-48 w-full mb-3 group">
                            {/* VU Meter Bars (Stereo mock) */}
                            <div className="absolute left-1 top-0 bottom-0 w-2 flex gap-0.5 pointer-events-none opacity-80">
                                <div className="w-1 h-full bg-gray-200 dark:bg-gray-700 rounded-sm relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 w-full bg-green-500 transition-all duration-75"
                                        style={{ height: `${meterVal * 100}%` }}
                                    ></div>
                                    <div
                                        className="absolute bottom-0 w-full bg-yellow-400 transition-all duration-75"
                                        style={{ height: `${Math.max(0, (meterVal - 0.7) * 100)}%` }}
                                    ></div>
                                    <div
                                        className="absolute bottom-0 w-full bg-red-500 transition-all duration-75"
                                        style={{ height: `${Math.max(0, (meterVal - 0.9) * 100)}%` }}
                                    ></div>
                                </div>
                                <div className="w-1 h-full bg-gray-200 dark:bg-gray-700 rounded-sm relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 w-full bg-green-500 transition-all duration-75 delay-75"
                                        style={{ height: `${(meterVal * 0.9 + 0.05 * (isPlaying ? 1 : 0)) * 100}%` }}
                                    ></div>
                                    <div
                                        className="absolute bottom-0 w-full bg-yellow-400 transition-all duration-75"
                                        style={{ height: `${Math.max(0, (meterVal * 0.9 - 0.7) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Vertical Slider */}
                            <input
                                type="range"
                                min="0"
                                max="1.5"
                                step="0.05"
                                value={vol}
                                onChange={(e) => onUpdateTrack(track.id, { volume: Number(e.target.value) })}
                                className="absolute w-44 h-2 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center -rotate-90 appearance-none bg-transparent cursor-pointer z-10"
                                style={{
                                    boxShadow: 'none',
                                }}
                                title={`Volume: ${Math.round(vol * 100)}%`}
                            />
                            <style>{`
                input[type='range']::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 16px;
                  height: 24px;
                  background: #d1d5db; /* gray-300 */
                  border: 1px solid #9ca3af;
                  border-radius: 4px;
                  cursor: pointer;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .dark input[type='range']::-webkit-slider-thumb {
                  background: #4b5563; /* gray-600 */
                  border-color: #374151;
                }
                input[type='range']::-webkit-slider-runnable-track {
                  background: transparent;
                  height: 2px;
                }
              `}</style>

                            {/* Slider Track Line Background */}
                            <div className="absolute right-4 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                        </div>

                        {/* Readout */}
                        <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                            {vol.toFixed(2)}
                        </div>

                        {/* Audio Indicator Icon */}
                        <div className="mt-2 text-gray-400 dark:text-gray-500">
                            {hasAudioElements ? (
                                <span className="text-blue-500">🎵</span>
                            ) : (
                                <span className="opacity-50">🎵</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default AudioMixerPanel;
