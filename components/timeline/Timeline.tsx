import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Track, EditorElement, Marker } from '../../types';
import TimelineTrack from './TimelineTrack';
import { MousePointerIcon, ScissorsIcon, SlipIcon, RollIcon, ZoomInIcon, ZoomOutIcon, MagnetIcon, CompressIcon, FitIcon } from '../ui/Icons';

export type ToolMode = 'pointer' | 'blade' | 'slip' | 'roll';

interface TimelineProps {
  tracks: Track[];
  elements: EditorElement[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onSelectElement: (id: string) => void;
  onToggleSelectElement: (id: string) => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
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
  toolMode?: ToolMode;
  setToolMode?: (mode: ToolMode) => void;
  onSplitElement?: (elementId: string, time: number) => void;
  onUpdateTrack?: (trackId: number, updates: Partial<Track>) => void;
}

type DragMode = 'MOVE' | 'RESIZE_L' | 'RESIZE_R' | 'SLIP' | 'ROLL';

// Magnetic snap threshold in pixels
const SNAP_THRESHOLD_PX = 10;

const Timeline: React.FC<TimelineProps> = ({
  tracks,
  elements,
  currentTime,
  duration,
  onSeek,
  onSelectElement,
  onToggleSelectElement,
  selectedElementId,
  selectedElementIds,
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
  onDeleteMarker,
  toolMode = 'pointer',
  setToolMode,
  onSplitElement,
  onUpdateTrack
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
  const [snapIndicator, setSnapIndicator] = useState<{ time: number } | null>(null);

  // Helper: Find all snap points
  const findSnapPoints = useCallback((excludeElementId: string): number[] => {
    const points: number[] = [0, currentTime];
    elements
      .filter(el => el.id !== excludeElementId)
      .forEach(el => {
        points.push(el.startTime);
        points.push(el.startTime + el.duration);
      });
    return points;
  }, [elements, currentTime]);

  // Helper: Snap to nearest point
  const snapToNearestPoint = useCallback((time: number, snapPoints: number[], shiftPressed: boolean): { snapped: number; didSnap: boolean } => {
    if (shiftPressed || !snapEnabled) {
      return { snapped: time, didSnap: false };
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

  const removeCurrentSnapPoint = (snapPoints: number[], currentPoint: number, deltaTime: number) => {
    if (deltaTime === 0) return snapPoints;
    return snapPoints.filter(point => Math.abs(point - currentPoint) > 0.0001);
  };

  // -- Playhead Logic --
  const handleRulerMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingPlayhead(true);
    updateTimeFromMouse(e);
  };

  const updateTimeFromMouse = (e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
    if (!rulerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = clientX - rect.left - 220;
    const newTime = Math.max(0, x / pixelsPerSecond);
    onSeek(newTime);
  };

  // -- Element Interaction Logic --
  const handleElementInteraction = (e: React.MouseEvent | React.TouchEvent, type: DragMode, elementId: string, trackId: number, startTime: number, duration: number, mediaOffset: number) => {
    e.stopPropagation();
    e.preventDefault();

    const isMetaKey = 'metaKey' in e && e.metaKey;
    const isCtrlKey = 'ctrlKey' in e && e.ctrlKey;

    if (isMetaKey || isCtrlKey) {
      onToggleSelectElement(elementId);
    } else {
      if (!selectedElementIds.includes(elementId)) {
        onSelectElement(elementId);
      }
    }

    let actualDragMode = type;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;

    if (toolMode === 'blade') {
      if (!containerRef.current || !onSplitElement) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left - 96;
      const clickTime = Math.max(0, clickX / pixelsPerSecond);
      onSplitElement(elementId, clickTime);
      return;
    } else if (toolMode === 'slip' && type === 'MOVE') {
      actualDragMode = 'SLIP';
    } else if (toolMode === 'roll') {
      actualDragMode = type === 'MOVE' ? 'ROLL' : type;
    }

    setDragState({
      mode: actualDragMode,
      elementId,
      startX: clientX,
      originalStartTime: startTime,
      originalDuration: duration,
      originalMediaOffset: mediaOffset,
      originalTrackId: trackId
    });
  };

  // Global Mouse Move / Up for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const isTouch = 'touches' in e;

      if (isDraggingPlayhead) {
        if (isTouch) e.preventDefault();
        updateTimeFromMouse(e);
      }

      if (dragState) {
        if (isTouch) e.preventDefault();
        const clientX = isTouch ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const shiftPressed = !isTouch && (e as MouseEvent).shiftKey;

        const deltaX = clientX - dragState.startX;
        const deltaTime = deltaX / pixelsPerSecond;

        const draggedElement = elements.find(el => el.id === dragState.elementId);
        const groupMembers = draggedElement?.groupId
          ? elements.filter(el => el.groupId === draggedElement.groupId && el.id !== draggedElement.id)
          : [];

        if (dragState.mode === 'MOVE') {
          let newStartTime = Math.max(0, dragState.originalStartTime + deltaTime);
          const trackElement = (e.target as HTMLElement).closest('[data-track-id]');
          let newTrackId = dragState.originalTrackId;

          if (trackElement) {
            const id = Number(trackElement.getAttribute('data-track-id'));
            if (!isNaN(id)) newTrackId = id;
          }

          const snapPoints = removeCurrentSnapPoint(
            findSnapPoints(dragState.elementId),
            dragState.originalStartTime,
            deltaTime
          );
          const startSnap = snapToNearestPoint(newStartTime, snapPoints, shiftPressed);

          if (startSnap.didSnap) {
            newStartTime = startSnap.snapped;
            setSnapIndicator({ time: startSnap.snapped });
          } else {
            setSnapIndicator(null);
          }

          const timeDelta = newStartTime - dragState.originalStartTime;

          onUpdateElement(dragState.elementId, {
            startTime: newStartTime,
            trackId: newTrackId
          });

          groupMembers.forEach(member => {
            onUpdateElement(member.id, {
              startTime: Math.max(0, member.startTime + timeDelta)
            });
          });

        } else if (dragState.mode === 'RESIZE_R') {
          let newEndTime = dragState.originalStartTime + dragState.originalDuration + deltaTime;
          const snapPoints = removeCurrentSnapPoint(
            findSnapPoints(dragState.elementId),
            dragState.originalStartTime + dragState.originalDuration,
            deltaTime
          );
          const snap = snapToNearestPoint(newEndTime, snapPoints, shiftPressed);

          if (snap.didSnap) {
            newEndTime = snap.snapped;
            setSnapIndicator({ time: snap.snapped });
          } else {
            setSnapIndicator(null);
          }

          const newDuration = Math.max(0.5, newEndTime - dragState.originalStartTime);
          onUpdateElement(dragState.elementId, { duration: newDuration });

        } else if (dragState.mode === 'RESIZE_L') {
          let newStartTime = dragState.originalStartTime + deltaTime;
          const snapPoints = removeCurrentSnapPoint(
            findSnapPoints(dragState.elementId),
            dragState.originalStartTime,
            deltaTime
          );
          const snap = snapToNearestPoint(newStartTime, snapPoints, shiftPressed);

          if (snap.didSnap) {
            newStartTime = snap.snapped;
            setSnapIndicator({ time: snap.snapped });
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
        } else if (dragState.mode === 'SLIP') {
          const deltaOffset = -deltaTime;
          const newOffset = Math.max(0, dragState.originalMediaOffset + deltaOffset);
          onUpdateElement(dragState.elementId, { mediaOffset: newOffset });
        } else if (dragState.mode === 'ROLL') {
          const deltaOffset = -deltaTime;
          const newOffset = Math.max(0, dragState.originalMediaOffset + deltaOffset);
          onUpdateElement(dragState.elementId, { mediaOffset: newOffset });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setDragState(null);
      setSnapIndicator(null);
    };

    if (isDraggingPlayhead || dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
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
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - 220;
      const dropTime = Math.max(0, x / pixelsPerSecond);
      onAddAsset(assetId, trackId, dropTime);
    }
  };

  const formatTimecode = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 24); // 24fps frames
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Generate V/A track labels
  const getTrackLabel = (track: Track, index: number) => {
    const videoTracks = tracks.filter(t => t.type !== 'audio');
    const audioTracks = tracks.filter(t => t.type === 'audio');
    if (track.type === 'audio') {
      const audioIndex = audioTracks.indexOf(track);
      return `A${audioIndex + 1}`;
    } else {
      const videoIndex = videoTracks.indexOf(track);
      return `V${videoTracks.length - videoIndex}`;
    }
  };

  const rulerTicks = [];
  const totalWidth = Math.max(duration, 60) * pixelsPerSecond + 500;
  for (let i = 0; i < Math.max(duration, 60); i++) {
    rulerTicks.push(
      <div
        key={i}
        className="absolute top-0 bottom-0 border-l border-pp-border text-[9px] text-pp-text-dim pl-0.5 select-none font-pp-mono"
        style={{ left: i * pixelsPerSecond }}
      >
        {i % 5 === 0 ? formatTime(i) : ''}
      </div>
    );
  }

  // Separate video and audio tracks
  const videoTracks = tracks.filter(t => t.type !== 'audio');
  const audioTracks = tracks.filter(t => t.type === 'audio');
  const orderedTracks = [...videoTracks.reverse(), ...audioTracks]; // V tracks reversed so V1 is at bottom

  return (
    <div className="flex flex-col h-full bg-pp-darkest text-pp-text select-none" ref={containerRef}>

      {/* Timeline Header Tab Bar - Premiere Pro style */}
      <div className="h-[28px] border-b border-[#111111] bg-[#232323] flex items-end px-2 justify-between flex-shrink-0 relative z-10 w-full">
        <div className="flex items-center h-full">
          {/* Sequence tab */}
          <div className="pp-panel-tab active h-full flex items-center shrink-0 gap-2 border-r border-[#111111]" data-tip="Timeline Panel">
            <span className="text-[10px] text-gray-500 hover:text-white cursor-pointer font-bold pb-0.5" data-tip="Close Timeline Panel">×</span>
            <span>Timeline: Main Sequence</span>
            <span className="text-[10px] text-gray-400 hover:text-white cursor-pointer ml-1" data-tip="Timeline Panel Menu">≡</span>
          </div>
        </div>

        {/* Essential right-side Timeline display tools (zoom) */}
        <div className="flex items-center space-x-1 pb-1">
          <button onClick={() => setPixelsPerSecond(Math.max(10, pixelsPerSecond - 20))} className="pp-icon-btn w-[20px] h-[20px]" data-tip="Zoom Out (-)">
            <ZoomOutIcon className="w-3 h-3" />
          </button>
          <input type="range" min="10" max="200" value={pixelsPerSecond} onChange={(e) => setPixelsPerSecond(Number(e.target.value))} className="pp-slider w-16" data-tip="Timeline Zoom Level" />
          <button onClick={() => setPixelsPerSecond(Math.min(200, pixelsPerSecond + 20))} className="pp-icon-btn w-[20px] h-[20px]" data-tip="Zoom In (+)">
            <ZoomInIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-grow relative overflow-x-auto overflow-y-auto custom-scrollbar">
        <div className="relative min-w-full" style={{ width: `${totalWidth + 220}px` }}>

          {/* Ruler - Premiere Pro style */}
          <div
            ref={rulerRef}
            className="h-[56px] bg-[#232323] border-b border-black/40 relative cursor-pointer"
            onMouseDown={handleRulerMouseDown}
            onTouchStart={handleRulerMouseDown}
            onDoubleClick={(e) => {
              if (onAddMarker && rulerRef.current) {
                const rect = rulerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left - 220;
                const time = Math.max(0, x / pixelsPerSecond);
                onAddMarker(time);
              }
            }}
          >
            {/* Top-Left Fixed Timecode Block */}
            <div className="w-[220px] h-full border-r border-black/40 absolute left-0 bg-[#1c1c1c] z-20 flex flex-col justify-center px-4 pt-1 cursor-default" onMouseDown={e => e.stopPropagation()}>
              <div className="text-[#4e9fd5] font-pp-mono text-[16px] tracking-wider mb-2">
                {formatTimecode(currentTime)}
              </div>
              <div className="flex items-center space-x-[14px] text-gray-500">
                {/* 1. Nesting */}
                <button data-tip="Insert and overwrite sequences as nests or individual clips" className="flex items-center justify-center outline-none hover:text-white cursor-pointer bg-transparent border-none p-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16v16H4z" /><path d="M4 10h16" /><path d="M10 4v16" /></svg>
                </button>
                {/* 2. Magnet (Snap) */}
                <button
                  onClick={onToggleSnap}
                  className={`flex items-center justify-center outline-none ${snapEnabled ? 'text-[#448aff]' : 'hover:text-white'} cursor-pointer bg-transparent border-none p-0`}
                  data-tip="Snap in Timeline (S)"
                >
                  <MagnetIcon className="w-3.5 h-3.5" />
                </button>
                {/* 3. Linked Selection */}
                <button data-tip="Linked Selection" className="flex items-center justify-center outline-none hover:text-white cursor-pointer bg-transparent border-none p-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                </button>
                {/* 4. Marker */}
                <button onClick={() => onAddMarker && onAddMarker(currentTime)} data-tip="Add Marker (M)" className="flex items-center justify-center outline-none hover:text-white cursor-pointer bg-transparent border-none p-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 22h18L12 2z" /></svg>
                </button>
                {/* 5. Wrench */}
                <button data-tip="Timeline Display Settings" className="flex items-center justify-center outline-none hover:text-white cursor-pointer bg-transparent border-none p-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                </button>
              </div>
            </div>

            <div className="absolute left-[220px] right-0 bottom-0 h-[24px]">
              {rulerTicks}
              {/* Markers */}
              {markers.map(marker => (
                <div
                  key={marker.id}
                  className="absolute bottom-0 w-3 h-3 -ml-1.5 z-30 cursor-pointer hover:scale-125 transition-transform"
                  style={{
                    left: marker.time * pixelsPerSecond,
                    backgroundColor: marker.color,
                    clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)'
                  }}
                  data-tip={`${marker.name} at ${formatTime(marker.time)}`}
                  onMouseDown={(e) => e.stopPropagation()}
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
              className="absolute top-0 w-px bg-pp-playhead z-30 pointer-events-none"
              style={{ left: `${(currentTime * pixelsPerSecond) + 220}px`, height: `${tracks.length * 40}px` }}
            >
              {/* Red triangle at top */}
              <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '8px solid #ff0000'
                }}
              />
            </div>

            {snapIndicator && (
              <div
                className="absolute top-0 w-0.5 bg-green-400 z-40 pointer-events-none"
                style={{ left: `${(snapIndicator.time * pixelsPerSecond) + 220}px`, height: `${tracks.length * 40}px` }}
              >
                <div className="w-2 h-2 bg-green-400 rounded-full transform -translate-x-1/2 absolute top-0" />
              </div>
            )}

            {orderedTracks.map((track, index) => (
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
                    onUpdateTrack={onUpdateTrack}
                    trackCount={tracks.length}
                    trackLabel={getTrackLabel(track, index)}
                  />
                </div>

                {/* Insert Layer Button */}
                {onInsertTrack && (
                  <div className="group relative h-0 w-full">
                    <div className="absolute left-0 right-0 top-0 h-2 -translate-y-1/2 z-20 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute inset-0 bg-pp-accent/20 hover:bg-pp-accent/40 transition-colors" />
                      <button
                        onClick={() => onInsertTrack(track.id)}
                        className="relative z-10 flex items-center space-x-1 bg-pp-accent hover:bg-pp-accent-hover text-white text-[10px] px-2 py-0.5 rounded-full shadow-lg transform scale-90 hover:scale-100 transition-all"
                      >
                        <span className="font-bold">+</span>
                        <span>Add Track</span>
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}

            {/* Video/Audio divider line */}
            {videoTracks.length > 0 && audioTracks.length > 0 && (
              <div
                className="absolute left-0 right-0 h-[2px] bg-pp-border z-20"
                style={{ top: `${videoTracks.length * 40}px` }}
              />
            )}
          </div>
        </div>
      </div>
    </div >
  );
};

export default Timeline;
