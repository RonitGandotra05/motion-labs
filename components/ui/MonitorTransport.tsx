import React from 'react';
import { PauseIcon, PlayIcon } from './Icons';

interface MonitorTransportProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  leftControls?: React.ReactNode;
  rightControls?: React.ReactNode;
  disabled?: boolean;
  stepAmount?: number;
}

const formatTimecode = (time: number) => {
  if (!Number.isFinite(time) || time < 0) return '00:00:00:00';
  const fps = 30;
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  const frames = Math.floor((time % 1) * fps);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
};

const clampTime = (time: number, duration: number) => Math.max(0, Math.min(duration || 0, time));

const MonitorTransport: React.FC<MonitorTransportProps> = ({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onTogglePlay,
  leftControls,
  rightControls,
  disabled = false,
  stepAmount = 1 / 30
}) => {
  const safeDuration = Math.max(duration || 0, 0.01);
  const progress = Math.min(100, (currentTime / safeDuration) * 100);

  return (
    <div className="flex-shrink-0 border-t border-black/30 bg-pp-dark px-4 pb-2 pt-1.5">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono leading-none">
        <div className="flex min-w-0 items-center gap-3">
          <span className="pp-timecode text-pp-timecode">{formatTimecode(currentTime)}</span>
          {leftControls}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {rightControls}
          <span className="pp-timecode text-pp-timecode">{formatTimecode(duration)}</span>
        </div>
      </div>

      <div className="mb-1.5">
        <div className="relative h-4">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-2 rounded-sm border border-[#262626] bg-[#161616]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to right, rgba(120,120,120,0.45) 0 1px, transparent 1px 10px)'
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-[7px] h-px bg-[#2e2e2e]" />
          <div
            className="pointer-events-none absolute left-0 top-0 h-2 rounded-sm bg-[#4e9fd5]"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min="0"
            max={safeDuration}
            step="0.01"
            value={Math.min(currentTime, safeDuration)}
            onChange={(e) => onSeek(Number(e.target.value))}
            disabled={disabled}
            className="pp-monitor-range absolute inset-x-0 top-[-2px] z-10 h-4 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-1">
        <button type="button" onClick={() => onSeek(0)} className="pp-transport-btn" disabled={disabled} data-tip="Go to Start">
          <span className="text-[10px]">⏮</span>
        </button>
        <button type="button" onClick={() => onSeek(clampTime(currentTime - stepAmount, duration))} className="pp-transport-btn" disabled={disabled} data-tip="Step Back">
          <span className="text-[10px]">◀</span>
        </button>
        <button type="button" onClick={onTogglePlay} className="pp-transport-btn h-8 w-8" disabled={disabled} data-tip={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={() => onSeek(clampTime(currentTime + stepAmount, duration))} className="pp-transport-btn" disabled={disabled} data-tip="Step Forward">
          <span className="text-[10px]">▶</span>
        </button>
        <button type="button" onClick={() => onSeek(duration)} className="pp-transport-btn" disabled={disabled} data-tip="Go to End">
          <span className="text-[10px]">⏭</span>
        </button>
      </div>
    </div>
  );
};

export default MonitorTransport;
