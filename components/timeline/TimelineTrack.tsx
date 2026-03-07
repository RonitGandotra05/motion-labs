import React from 'react';
import { EditorElement, Track, ElementType } from '../../types';
import Waveform from './Waveform';

interface TimelineTrackProps {
  track: Track;
  elements: EditorElement[];
  currentTime: number;
  pixelsPerSecond: number;
  onSelectElement: (id: string) => void;
  selectedElementId: string | null;
  onUpdateElement: (id: string, updates: Partial<EditorElement>) => void;
  onElementInteraction: (e: React.MouseEvent | React.TouchEvent, type: 'MOVE' | 'RESIZE_L' | 'RESIZE_R', elementId: string, trackId: number, startTime: number, duration: number, mediaOffset: number) => void;
  onInsertTrack?: (afterTrackId: number) => void;
  onDeleteTrack?: (trackId: number) => void;
  onUpdateTrack?: (trackId: number, updates: Partial<Track>) => void;
  trackCount?: number;
  trackLabel?: string; // V1, V2, A1, A2 etc.
}

const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  elements,
  pixelsPerSecond,
  onSelectElement,
  selectedElementId,
  onUpdateElement,
  onElementInteraction,
  onInsertTrack,
  onDeleteTrack,
  onUpdateTrack,
  trackCount = 1,
  selectedElementIds = [],
  trackLabel
}) => {
  const isAudioTrack = track.type === 'audio';
  const label = trackLabel || track.name;

  // Derive display name: "Video X" or "Audio X" based on track type
  const getDisplayName = () => {
    if (track.name?.startsWith('Layer')) {
      const num = label.replace(/[^0-9]/g, '');
      return isAudioTrack ? `Audio ${num}` : `Video ${num}`;
    }
    return track.name || (isAudioTrack ? `Audio ${label.replace('A', '')}` : `Video ${label.replace('V', '')}`);
  };

  const getClipClass = (type: ElementType) => {
    switch (type) {
      case ElementType.VIDEO: return 'pp-clip-video';
      case ElementType.AUDIO: return 'pp-clip-audio';
      case ElementType.TEXT: return 'pp-clip-text';
      case ElementType.IMAGE: return 'pp-clip-image';
      case ElementType.AI_GENERATED: return 'pp-clip-text';
      case ElementType.ADJUSTMENT: return 'bg-gradient-to-b from-orange-400 to-orange-500 border border-white/10';
      default: return 'pp-clip-video';
    }
  };

  return (
    <div className="flex h-[40px] border-b border-black/40 relative group/track" style={{ background: '#232323' }}>
      {/* Track Header - Premiere Pro style */}
      <div className="pp-track-header flex-shrink-0 flex items-center z-10 select-none group/header relative bg-[#1c1c1c] border-r border-[#111111]" style={{ width: '220px' }}>

        {/* Source patch col */}
        <div className="flex flex-col justify-center items-center w-[30px] border-r border-[#2a2a2a] h-full pr-1 shrink-0">
          <button
            className="w-[22px] h-[20px] bg-[#0c4076] hover:bg-[#1a5b99] flex items-center justify-center text-[#99c2ff] hover:text-white text-[10px] font-bold cursor-pointer rounded-[1px] shadow-sm border-none p-0 outline-none"
            data-tip="Source Patching"
          >
            {isAudioTrack ? 'A1' : 'V1'}
          </button>
        </div>

        {/* Lock & Targeting Col */}
        <div className="flex items-center w-[54px] border-r border-[#2a2a2a] h-full justify-center px-1 gap-1 shrink-0">
          {/* Lock icon - Premiere Pro padlock style */}
          <button
            className={`pp-icon-btn w-[16px] h-[16px] flex-shrink-0 flex items-center justify-center ${track.isLocked ? 'text-[#e8b84a]' : 'text-gray-500 hover:text-gray-300'}`}
            data-tip={track.isLocked ? 'Unlock Track' : 'Lock Track'}
            onClick={() => onUpdateTrack?.(track.id, { isLocked: !track.isLocked })}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {track.isLocked ? (
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </>
              ) : (
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                </>
              )}
            </svg>
          </button>

          {/* Track targeting button */}
          <button
            className="w-[22px] h-[20px] bg-[#0c4076] hover:bg-[#1a5b99] flex items-center justify-center text-[#99c2ff] hover:text-white text-[10px] font-bold cursor-pointer rounded-[1px] shadow-sm border-none p-0 outline-none"
            data-tip="Track Targeting"
          >
            {label}
          </button>
        </div>

        {/* Sync Lock Col */}
        <button
          className="flex justify-center items-center w-[20px] h-full border-r border-[#2a2a2a] shrink-0 cursor-pointer bg-transparent border-t-0 border-b-0 border-l-0 p-0 outline-none hover:bg-white/5"
          data-tip="Sync Lock"
        >
          <div className="w-2 h-[2px] bg-gray-600 rounded-sm pointer-events-none"></div>
        </button>

        {/* Toggles Col (Eye for V, M/S/Mic for A) */}
        <div className="flex items-center flex-1 px-2 h-full gap-2 overflow-hidden shrink-0">
          {!isAudioTrack ? (
            <>
              {/* Video: Speaker icon for track monitor */}
              <button
                className={`flex-shrink-0 flex items-center justify-center w-[16px] h-[16px] ${track.isMuted ? 'text-[#e84a4a]' : 'text-gray-500 hover:text-white'}`}
                data-tip={track.isMuted ? 'Unmute Track' : 'Mute Track'}
                onClick={() => onUpdateTrack?.(track.id, { isMuted: !track.isMuted })}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {track.isMuted ? (
                    <>
                      <rect x="2" y="6" width="6" height="12" rx="1" />
                      <path d="M8 6l6-4v20l-6-4" />
                      <line x1="18" y1="9" x2="24" y2="15" />
                      <line x1="24" y1="9" x2="18" y2="15" />
                    </>
                  ) : (
                    <>
                      <rect x="2" y="6" width="6" height="12" rx="1" />
                      <path d="M8 6l6-4v20l-6-4" />
                    </>
                  )}
                </svg>
              </button>
              {/* Video Eye Icon */}
              <button
                className={`flex-shrink-0 flex items-center justify-center w-[16px] h-[16px] ${track.isVisible ? 'text-gray-400 hover:text-white' : 'text-[#2a2a2a] hover:text-gray-500'}`}
                data-tip={track.isVisible ? 'Hide Track' : 'Show Track'}
                onClick={() => onUpdateTrack?.(track.id, { isVisible: !track.isVisible })}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {track.isVisible ? (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  )}
                </svg>
              </button>
              {/* Track Name */}
              <span className="text-[11px] font-medium text-gray-300 truncate">
                {getDisplayName()}
              </span>
            </>
          ) : (
            <>
              {/* Audio: Speaker/Monitor icon */}
              <button
                className={`flex-shrink-0 flex items-center justify-center w-[16px] h-[16px] ${track.isMuted ? 'text-[#e84a4a]' : 'text-gray-500 hover:text-white'}`}
                data-tip={track.isMuted ? 'Unmute Track' : 'Mute Track'}
                onClick={() => onUpdateTrack?.(track.id, { isMuted: !track.isMuted })}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {track.isMuted ? (
                    <>
                      <rect x="2" y="6" width="6" height="12" rx="1" />
                      <path d="M8 6l6-4v20l-6-4" />
                      <line x1="18" y1="9" x2="24" y2="15" />
                      <line x1="24" y1="9" x2="18" y2="15" />
                    </>
                  ) : (
                    <>
                      <rect x="2" y="6" width="6" height="12" rx="1" />
                      <path d="M8 6l6-4v20l-6-4" />
                    </>
                  )}
                </svg>
              </button>
              {/* Audio M/S/Mic */}
              <button
                className={`w-[16px] h-[16px] bg-transparent border rounded-[1px] flex items-center justify-center text-[9px] font-bold pb-[1px] flex-shrink-0 ${track.isMuted ? 'border-[#e84a4a] text-[#e84a4a] bg-[#e84a4a]/20' : 'border-gray-600 text-gray-500 hover:text-white'}`}
                data-tip={track.isMuted ? 'Unmute Track' : 'Mute Track'}
                onClick={() => onUpdateTrack?.(track.id, { isMuted: !track.isMuted })}
              >
                M
              </button>
              <button
                className={`w-[16px] h-[16px] bg-transparent border rounded-[1px] flex items-center justify-center text-[9px] font-bold pb-[1px] flex-shrink-0 ${track.isSoloed ? 'border-[#e8d44a] text-[#e8d44a] bg-[#e8d44a]/20' : 'border-gray-600 text-gray-500 hover:text-white'}`}
                data-tip={track.isSoloed ? 'Unsolo Track' : 'Solo Track'}
                onClick={() => onUpdateTrack?.(track.id, { isSoloed: !track.isSoloed })}
              >
                S
              </button>
              {/* Microphone icon */}
              <button
                className="w-[16px] h-[16px] text-gray-500 hover:text-white flex items-center justify-center flex-shrink-0"
                data-tip="Voice-over Record"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              {/* Track Name */}
              <span className="text-[11px] font-medium text-gray-300 truncate ml-1">
                {getDisplayName()}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Track Content (Timeline) */}
      <div className={`flex-grow relative h-full overflow-hidden ${!track.isVisible ? 'opacity-30' : ''}`} style={{ background: isAudioTrack ? '#1f2a1f' : '#1e2430' }}>
        {elements.filter(el => el.trackId === track.id).map((el) => {
          const left = el.startTime * pixelsPerSecond;
          const width = el.duration * pixelsPerSecond;
          const isSelected = selectedElementId === el.id || selectedElementIds.includes(el.id);

          return (
            <div
              key={el.id}
              className={`absolute top-[2px] bottom-[2px] rounded-[2px] cursor-grab active:cursor-grabbing select-none overflow-hidden text-[10px] flex items-center px-1.5 whitespace-nowrap
                ${getClipClass(el.type)}
                ${isSelected ? 'ring-2 ring-white ring-opacity-80 z-10 brightness-110' : 'hover:brightness-110'}
              `}
              style={{ left: `${left}px`, width: `${width}px` }}
              onMouseDown={(e) => onElementInteraction(e, 'MOVE', el.id, el.trackId, el.startTime, el.duration, el.mediaOffset)}
              onTouchStart={(e) => onElementInteraction(e, 'MOVE', el.id, el.trackId, el.startTime, el.duration, el.mediaOffset)}
            >
              {/* Audio Waveform */}
              {(el.type === ElementType.AUDIO || el.type === ElementType.VIDEO) && el.props.src && (
                <div className="absolute inset-0 opacity-40 z-0 pointer-events-none overflow-hidden">
                  <div
                    style={{
                      width: `${(el.duration + el.mediaOffset) / el.duration * 100}%`,
                      height: '100%',
                      transform: `translateX(-${(el.mediaOffset / (el.duration + el.mediaOffset)) * 100}%)`,
                      position: 'relative'
                    }}
                  >
                    <Waveform audioUrl={el.props.src} duration={el.duration + el.mediaOffset} />
                  </div>
                </div>
              )}

              {/* Clip name */}
              <span className="truncate pointer-events-none relative z-10 text-white/90 font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {el.name}
              </span>

              {/* Clip color label indicator */}
              {el.clipColor && el.clipColor !== 'none' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[3px]"
                  style={{ backgroundColor: el.clipColor }}
                />
              )}

              {/* Resize handles */}
              {isSelected && (
                <>
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[5px] bg-white/20 hover:bg-white/50 cursor-ew-resize z-20"
                    onMouseDown={(e) => onElementInteraction(e, 'RESIZE_L', el.id, el.trackId, el.startTime, el.duration, el.mediaOffset)}
                    onTouchStart={(e) => onElementInteraction(e, 'RESIZE_L', el.id, el.trackId, el.startTime, el.duration, el.mediaOffset)}
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-[5px] bg-white/20 hover:bg-white/50 cursor-ew-resize z-20"
                    onMouseDown={(e) => onElementInteraction(e, 'RESIZE_R', el.id, el.trackId, el.startTime, el.duration, el.mediaOffset)}
                    onTouchStart={(e) => onElementInteraction(e, 'RESIZE_R', el.id, el.trackId, el.startTime, el.duration, el.mediaOffset)}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineTrack;