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
  onElementInteraction: (e: React.MouseEvent, type: 'MOVE' | 'RESIZE_L' | 'RESIZE_R', elementId: string, trackId: number, startTime: number, duration: number, mediaOffset: number) => void;
  onInsertTrack?: (afterTrackId: number) => void;
  onDeleteTrack?: (trackId: number) => void;
  trackCount?: number;
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
  trackCount = 1
}) => {
  return (
    <div className="flex h-12 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 relative group/track transition-colors">
      {/* Track Header (Left) */}
      <div className="w-24 flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex items-center px-2 text-xs text-gray-500 dark:text-gray-400 z-10 select-none transition-colors group/header relative">
        {/* Layer Name - always visible */}
        <span className="truncate flex-1">{track.name}</span>

        {/* Track Control Buttons - overlay on hover */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center space-x-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity bg-gray-50 dark:bg-gray-800 rounded pl-1">
          {/* Add Layer Button */}
          {onInsertTrack && (
            <button
              onClick={() => onInsertTrack(track.id)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-500 dark:text-blue-400 transition-colors"
              title="Add layer below"
            >
              <span className="text-sm font-bold">+</span>
            </button>
          )}

          {/* Delete Layer Button - only show if more than 1 track */}
          {onDeleteTrack && trackCount > 1 && (
            <button
              onClick={() => onDeleteTrack(track.id)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 dark:text-red-400 transition-colors"
              title="Delete layer"
            >
              <span className="text-sm">×</span>
            </button>
          )}
        </div>
      </div>

      {/* Track Content (Timeline) */}
      <div className="flex-grow relative h-full overflow-hidden">
        {elements.filter(el => el.trackId === track.id).map((el) => {
          const left = el.startTime * pixelsPerSecond;
          const width = el.duration * pixelsPerSecond;
          const isSelected = selectedElementId === el.id;

          return (
            <div
              key={el.id}
              className={`absolute top-1 bottom-1 rounded-sm cursor-grab active:cursor-grabbing select-none overflow-hidden text-xs flex items-center px-2 whitespace-nowrap transition-colors
                ${isSelected
                  ? 'bg-blue-500 border border-blue-600 z-10 text-white'
                  : 'bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-800/80 text-blue-900 dark:text-blue-100'}
              `}
              style={{ left: `${left}px`, width: `${width}px` }}
              onMouseDown={(e) => onElementInteraction(e, 'MOVE', el.id, el.trackId, el.startTime, el.duration, el.mediaOffset)}
            >
              {/* Audio Waveform */}
              {(el.type === ElementType.AUDIO || el.type === ElementType.VIDEO) && el.props.src && (
                <div className="absolute inset-0 opacity-50 z-0 pointer-events-none overflow-hidden">
                  {/* We need to render the *whole* waveform and then position/crop it based on mediaOffset */}
                  {/* However, for performance, a simple approach is to render it in a container that shifts */}
                  <div
                    style={{
                      width: `${(el.duration + el.mediaOffset) / el.duration * 100}%`,
                      height: '100%',
                      transform: `translateX(-${(el.mediaOffset / (el.duration + el.mediaOffset)) * 100}%)`,
                      position: 'relative'
                    }}
                  >
                    {/* Note: This assumes src is a blob URL or similar that we can fetch. */}
                    {/* For remote URLs, CORS might be an issue without proxy/config. */}
                    <Waveform audioUrl={el.props.src} duration={el.duration + el.mediaOffset} />
                  </div>
                </div>
              )}

              <span className="truncate drop-shadow-sm pointer-events-none relative z-10 mix-blend-difference text-white">{el.name}</span>

              {isSelected && (
                <>
                  {/* Only show resize handles for stretchable elements (not video/audio) */}
                  {el.type !== ElementType.VIDEO && el.type !== ElementType.AUDIO && (
                    <>
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 bg-white/30 hover:bg-white/50 cursor-ew-resize"
                        onMouseDown={(e) => onElementInteraction(e, 'RESIZE_L', el.id, el.trackId, el.startTime, el.duration, el.mediaOffset)}
                      ></div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 hover:bg-white/50 cursor-ew-resize"
                        onMouseDown={(e) => onElementInteraction(e, 'RESIZE_R', el.id, el.trackId, el.startTime, el.duration, el.mediaOffset)}
                      ></div>
                    </>
                  )}
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