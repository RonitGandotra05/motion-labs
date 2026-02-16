import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Track, EditorElement, Marker } from '../../types';
import TimelineTrack from './TimelineTrack';
import { ScissorsIcon, ZoomInIcon, ZoomOutIcon, MagnetIcon, CompressIcon, FitIcon } from '../ui/Icons';

interface TimelineProps {
  tracks: Track[];
  elements: EditorElement[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onSelectElement: (id: string) => void;
  selectedElementId: string | null;
  onUpdateElement: (id: string, updates: Partial<EditorElement>) => void;
  onSplit: () => void;
  pixelsPerSecond: number;
  setPixelsPerSecond: (pps: number) => void;
  onAddAsset?: (assetId: string, trackId: number, startTime: number) => void;
  onInsertTrack?: (afterTrackId: number) => void;
  onDeleteTrack?: (trackId: number) => void;
  rippleEditMode?: boolean;
  onToggleRippleEdit?: () => void;
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
  onCloseGaps?: () => void;
  markers?: Marker[];
  onAddMarker?: (time: number) => void;
  onUpdateMarker?: (id: string, updates: Partial<Marker>) => void;
  onDeleteMarker?: (id: string) => void;
}

type DragMode = 'MOVE' | 'RESIZE_L' | 'RESIZE_R';

// Magnetic snap threshold in pixels
const SNAP_THRESHOLD_PX = 10;

const Timeline: React.FC<TimelineProps> = ({
  tracks,
  elements,
  currentTime,
  duration,
  onSeek,
  onSelectElement,
  selectedElementId,
  onUpdateElement,
  onSplit,
  pixelsPerSecond,
  setPixelsPerSecond,
  onAddAsset,
  onInsertTrack,
  onDeleteTrack,
  rippleEditMode = false,
  onToggleRippleEdit,
  snapEnabled = true,
  onToggleSnap,
  onCloseGaps,
  markers = [],
  onAddMarker,
  onUpdateMarker,
  onDeleteMarker
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Playhead Drag State
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  // Element Drag State
  const [dragState, setDragState] = useState<{
    mode: DragMode;
    elementId: string;
    startX: number;
    originalStartTime: number;
    originalDuration: number;
    originalMediaOffset: number;
    originalTrackId: number;
  } | null>(null);

  // Snap indicator state
  const [snapIndicator, setSnapIndicator] = useState<{ time: number; trackId: number } | null>(null);

  // Helper: Find all snap points (element edges + playhead) on a given track, excluding the dragged element
  const findSnapPoints = useCallback((trackId: number, excludeElementId: string): number[] => {
    const points: number[] = [0, currentTime]; // Include time 0 and playhead position
    elements
      .filter(el => el.trackId === trackId && el.id !== excludeElementId)
      .forEach(el => {
        points.push(el.startTime); // Start edge
        points.push(el.startTime + el.duration); // End edge
      });
    return points;
  }, [elements, currentTime]);

  // Helper: Snap a time value to nearest snap point if within threshold
  const snapToNearestPoint = useCallback((time: number, snapPoints: number[], shiftPressed: boolean): { snapped: number; didSnap: boolean } => {
    if (shiftPressed || !snapEnabled) {
      return { snapped: time, didSnap: false }; // Shift or snap disabled
    }

    const thresholdTime = SNAP_THRESHOLD_PX / pixelsPerSecond;
    let nearestPoint = time;
    let minDistance = Infinity;

    for (const point of snapPoints) {
      const distance = Math.abs(time - point);
      if (distance < minDistance && distance < thresholdTime) {
        minDistance = distance;
        nearestPoint = point;
      }
    }

    return { snapped: nearestPoint, didSnap: minDistance < thresholdTime };
  }, [pixelsPerSecond]);

  // -- Playhead Logic --
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    setIsDraggingPlayhead(true);
    updateTimeFromMouse(e);
  };

  const updateTimeFromMouse = (e: MouseEvent | React.MouseEvent) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 96;
    const newTime = Math.max(0, x / pixelsPerSecond);
    onSeek(newTime);
  };

  // -- Element Interaction Logic --
  const handleElementInteraction = (e: React.MouseEvent, type: DragMode, elementId: string, trackId: number, startTime: number, duration: number, mediaOffset: number) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectElement(elementId);

    setDragState({
      mode: type,
      elementId,
      startX: e.clientX,
      originalStartTime: startTime,
      originalDuration: duration,
      originalMediaOffset: mediaOffset,
      originalTrackId: trackId
    });
  };

  // Global Mouse Move / Up for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead) {
        updateTimeFromMouse(e);
      }

      if (dragState) {
        e.preventDefault();
        const deltaX = e.clientX - dragState.startX;
        const deltaTime = deltaX / pixelsPerSecond;
        const shiftPressed = e.shiftKey;

        // Find if dragging a group
        const draggedElement = elements.find(el => el.id === dragState.elementId);
        const groupMembers = draggedElement?.groupId
          ? elements.filter(el => el.groupId === draggedElement.groupId && el.id !== draggedElement.id)
          : [];

        if (dragState.mode === 'MOVE') {
          let newStartTime = Math.max(0, dragState.originalStartTime + deltaTime);
          const elementDuration = dragState.originalDuration;

          // Determine Track (Only for the primary dragged element for now)
          // Group members move relative to their own start times
          const trackElement = (e.target as HTMLElement).closest('[data-track-id]');
          let newTrackId = dragState.originalTrackId;

          if (trackElement) {
            const id = Number(trackElement.getAttribute('data-track-id'));
            if (!isNaN(id)) newTrackId = id;
          }

          // Apply magnetic snapping (primary element only)
          const snapPoints = findSnapPoints(newTrackId, dragState.elementId);
          const startSnap = snapToNearestPoint(newStartTime, snapPoints, shiftPressed);

          if (startSnap.didSnap) {
            newStartTime = startSnap.snapped;
            setSnapIndicator({ time: startSnap.snapped, trackId: newTrackId });
          } else {
            setSnapIndicator(null);
          }

          const timeDelta = newStartTime - dragState.originalStartTime;
          const trackDelta = newTrackId - dragState.originalTrackId;

          // Update Primary Element
          onUpdateElement(dragState.elementId, {
            startTime: newStartTime,
            trackId: newTrackId
          });

          // Update Group Members (Move by same time delta, keep track relative or same? Usually groups move across tracks together if selected together, but here we only dragged one.)
          // DaVinci behavior: If you drag one clip in a linked group, they all move in time. They usually stay on their respective tracks unless explicitly moved.
          // Let's implement: Move in sync time-wise. Keep track same (unless we want to support multi-track move, which is hard with single mouse pointer).
          groupMembers.forEach(member => {
            onUpdateElement(member.id, {
              startTime: Math.max(0, member.startTime + timeDelta)
              // We do NOT change move trackId for members automatically to avoid collisions or complex logic
            });
          });

        } else if (dragState.mode === 'RESIZE_R') {
          // ... (Resize logic typically doesn't affect group members unless we want 'ripple' effect, but standard Group doesn't resize together usually)
          // For now, only resize the specific element.
          let newEndTime = dragState.originalStartTime + dragState.originalDuration + deltaTime;
          const snapPoints = findSnapPoints(dragState.originalTrackId, dragState.elementId);
          const snap = snapToNearestPoint(newEndTime, snapPoints, shiftPressed);

          if (snap.didSnap) {
            newEndTime = snap.snapped;
            setSnapIndicator({ time: snap.snapped, trackId: dragState.originalTrackId });
          } else {
            setSnapIndicator(null);
          }

          const newDuration = Math.max(0.5, newEndTime - dragState.originalStartTime);
          onUpdateElement(dragState.elementId, {
            duration: newDuration
          });

        } else if (dragState.mode === 'RESIZE_L') {
          // ...
          let newStartTime = dragState.originalStartTime + deltaTime;
          // ... (snapping logic)
          const snapPoints = findSnapPoints(dragState.originalTrackId, dragState.elementId);
          const snap = snapToNearestPoint(newStartTime, snapPoints, shiftPressed);

          if (snap.didSnap) {
            newStartTime = snap.snapped;
            setSnapIndicator({ time: snap.snapped, trackId: dragState.originalTrackId });
          } else {
            setSnapIndicator(null);
          }

          if (newStartTime < 0) newStartTime = 0;

          const effectiveDelta = newStartTime - dragState.originalStartTime;
          const newDuration = Math.max(0.5, dragState.originalDuration - effectiveDelta);

          if (newDuration === 0.5) {
            newStartTime = dragState.originalStartTime + (dragState.originalDuration - 0.5);
          }

          onUpdateElement(dragState.elementId, {
            startTime: newStartTime,
            duration: newDuration,
            mediaOffset: dragState.originalMediaOffset + effectiveDelta
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setDragState(null);
      setSnapIndicator(null); // Clear snap indicator on release
    };

    if (isDraggingPlayhead || dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, dragState, pixelsPerSecond, onSeek, onUpdateElement, findSnapPoints, snapToNearestPoint]);


  // -- Library Asset Drop Logic --
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent, trackId: number) => {
    e.preventDefault();

    const assetId = e.dataTransfer.getData('application/react-frame-asset-id');

    if (assetId && onAddAsset) {
      // Calculate time from drop position relative to the track container
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - 96;
      const dropTime = Math.max(0, x / pixelsPerSecond);

      onAddAsset(assetId, trackId, dropTime);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const rulerTicks = [];
  const totalWidth = Math.max(duration, 60) * pixelsPerSecond + 500;
  for (let i = 0; i < Math.max(duration, 60); i++) {
    rulerTicks.push(
      <div key={i} className="absolute top-0 bottom-0 border-l border-gray-300 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-500 pl-1 select-none transition-colors" style={{ left: i * pixelsPerSecond }}>
        {i % 5 === 0 ? formatTime(i) : ''}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 select-none transition-colors" ref={containerRef}>

      {/* Tools / Header */}
      <div className="h-10 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-4 justify-between transition-colors">
        <div className="flex space-x-4 text-xs items-center">
          <span className="font-mono text-blue-600 dark:text-blue-400">{formatTime(currentTime)}</span>
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700"></div>

          <button
            onClick={onSplit}
            className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded transition text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white"
            title="Split Clip at Playhead"
          >
            <ScissorsIcon className="w-4 h-4" />
            <span>Split</span>
          </button>

          {onToggleRippleEdit && (
            <button
              onClick={onToggleRippleEdit}
              className={`flex items-center space-x-1 px-2 py-1 rounded transition ${rippleEditMode ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              title="Ripple Edit Mode - shifts subsequent clips when trimming/deleting"
            >
              <span>⟷</span>
              <span>Ripple</span>
            </button>
          )}

          {/* Snap Toggle */}
          {onToggleSnap && (
            <button
              onClick={onToggleSnap}
              className={`flex items-center space-x-1 px-2 py-1 rounded transition ${snapEnabled ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              title={snapEnabled ? "Snapping On (click to disable)" : "Snapping Off (click to enable)"}
            >
              <MagnetIcon className="w-4 h-4" />
              <span>Snap</span>
            </button>
          )}

          {/* Close Gaps */}
          {onCloseGaps && (
            <button
              onClick={onCloseGaps}
              className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded transition text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white"
              title="Close all gaps between clips"
            >
              <CompressIcon className="w-4 h-4" />
              <span>Close Gaps</span>
            </button>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setPixelsPerSecond(Math.max(10, pixelsPerSecond - 20))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition text-gray-600 dark:text-gray-300"
            title="Zoom Out (-)"
          >
            <ZoomOutIcon className="w-4 h-4" />
          </button>
          <input
            type="range" min="10" max="200"
            value={pixelsPerSecond}
            onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
            className="w-20 h-1 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <button
            onClick={() => setPixelsPerSecond(Math.min(200, pixelsPerSecond + 20))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition text-gray-600 dark:text-gray-300"
            title="Zoom In (+)"
          >
            <ZoomInIcon className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
          <button
            onClick={() => {
              // Fit all elements in view
              if (elements.length > 0) {
                const maxEndTime = Math.max(...elements.map(el => el.startTime + el.duration));
                const containerWidth = containerRef.current?.clientWidth || 800;
                const newPPS = Math.max(10, Math.min(200, (containerWidth - 150) / maxEndTime));
                setPixelsPerSecond(Math.round(newPPS));
              }
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition text-gray-600 dark:text-gray-300"
            title="Fit to Window (Shift+Z)"
          >
            <FitIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-grow relative overflow-x-auto overflow-y-auto custom-scrollbar">
        <div className="relative min-w-full" style={{ width: `${totalWidth + 96}px` }}>

          {/* Ruler */}
          <div
            ref={rulerRef}
            className="h-8 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 relative cursor-pointer transition-colors"
            onMouseDown={handleRulerMouseDown}
            onDoubleClick={(e) => {
              if (onAddMarker && rulerRef.current) {
                const rect = rulerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left - 96;
                const time = Math.max(0, x / pixelsPerSecond);
                onAddMarker(time);
              }
            }}
          >
            <div className="w-24 h-full border-r border-gray-200 dark:border-gray-700 absolute left-0 bg-gray-100 dark:bg-gray-800 z-20 transition-colors"></div>
            <div className="absolute left-24 right-0 top-0 bottom-0">
              {rulerTicks}
              {/* Markers */}
              {markers.map(marker => (
                <div
                  key={marker.id}
                  className={`absolute top-0 w-3 h-3 -ml-1.5 z-30 cursor-pointer hover:scale-125 transition-transform`}
                  style={{
                    left: marker.time * pixelsPerSecond,
                    backgroundColor: marker.color,
                    clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)'
                  }}
                  title={`${marker.name} at ${formatTime(marker.time)}`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUpdateMarker) {
                      const newName = prompt("Edit Marker Name:", marker.name);
                      if (newName !== null) {
                        onUpdateMarker(marker.id, { name: newName });
                      }
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onDeleteMarker && confirm(`Delete marker "${marker.name}"?`)) {
                      onDeleteMarker(marker.id);
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Tracks */}
          <div className="relative">
            {/* Playhead */}
            <div
              className="absolute top-0 w-px bg-red-500 z-30 pointer-events-none"
              style={{ left: `${(currentTime * pixelsPerSecond) + 96}px`, height: `${tracks.length * 48}px` }}
            >
              <div className="w-3 h-3 bg-red-500 transform -translate-x-1/2 -translate-y-1/2 rotate-45 absolute top-0"></div>
            </div>

            {snapIndicator && (
              <div
                className="absolute top-0 w-0.5 bg-green-500 z-40 pointer-events-none animate-pulse"
                style={{ left: `${(snapIndicator.time * pixelsPerSecond) + 96}px`, height: `${tracks.length * 48}px` }}
              >
                <div className="w-2 h-2 bg-green-500 rounded-full transform -translate-x-1/2 absolute top-0"></div>
              </div>
            )}

            {tracks.map((track, index) => (
              <React.Fragment key={track.id}>
                <div
                  data-track-id={track.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, track.id)}
                >
                  <TimelineTrack
                    track={track}
                    elements={elements}
                    currentTime={currentTime}
                    pixelsPerSecond={pixelsPerSecond}
                    onSelectElement={onSelectElement}
                    selectedElementId={selectedElementId}
                    onUpdateElement={onUpdateElement}
                    onElementInteraction={handleElementInteraction}
                    onInsertTrack={onInsertTrack}
                    onDeleteTrack={onDeleteTrack}
                    trackCount={tracks.length}
                  />
                </div>

                {/* Insert Layer Button - appears on hover between tracks */}
                {onInsertTrack && (
                  <div
                    className="group relative h-0 w-full"
                  >
                    <div className="absolute left-0 right-0 top-0 h-2 -translate-y-1/2 z-20 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute inset-0 bg-blue-500/20 hover:bg-blue-500/40 transition-colors" />
                      <button
                        onClick={() => onInsertTrack(track.id)}
                        className="relative z-10 flex items-center space-x-1 bg-blue-500 hover:bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-lg transform scale-90 hover:scale-100 transition-all"
                      >
                        <span className="font-bold">+</span>
                        <span>Add Layer</span>
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div >
  );
};

export default Timeline;