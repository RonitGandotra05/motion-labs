import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LayersIcon, DownloadIcon, SunIcon, MoonIcon, SaveIcon, FolderOpenIcon } from './components/ui/Icons';
import AssetsPanel from './components/panels/AssetsPanel';
import SettingsPanel from './components/panels/SettingsPanel';
import PropertiesPanel from './components/panels/PropertiesPanel';
import VideoPreview, { VideoPreviewHandle } from './components/preview/VideoPreview';
import Timeline from './components/timeline/Timeline';
import { ProjectState, Track, EditorElement, ElementType, ElementProps, Marker } from './types';
import { DEFAULT_TRACKS, INITIAL_DURATION, PIXELS_PER_SECOND_DEFAULT } from './constants';
import { getAssetById, getAssets, saveProjectState, loadProjectState } from './utils/db';
import { saveProjectToFile, openProjectFilePicker } from './utils/projectFile';
import { historyManager, HistoryState } from './utils/history';
import KeyboardShortcutsModal from './components/ui/KeyboardShortcutsModal';
import ExportModal from './components/ui/ExportModal';

const OLD_STORAGE_KEY = 'reactframe_project'; // For migration from localStorage

function App() {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const previewRef = useRef<VideoPreviewHandle>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(PIXELS_PER_SECOND_DEFAULT);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to dark mode
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [timelineHeight, setTimelineHeight] = useState(300);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [rippleEditMode, setRippleEditMode] = useState(false); // DaVinci-style ripple edit
  const [snapEnabled, setSnapEnabled] = useState(true); // Magnetic snap toggle
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  const [project, setProject] = useState<ProjectState>({
    currentTime: 0,
    duration: INITIAL_DURATION,
    isPlaying: false,
    zoomLevel: 1,
    elements: [],
    tracks: DEFAULT_TRACKS,
    markers: [], // Timeline markers
    selectedElementId: null,
    videoSrc: null,
    isExporting: false,
  });

  // Load project state from IndexedDB on mount
  useEffect(() => {
    const loadProject = async () => {
      try {
        // Try to load from IndexedDB first
        let data = await loadProjectState();

        // If no IndexedDB data, check for old localStorage data (migration)
        if (!data) {
          const oldData = localStorage.getItem(OLD_STORAGE_KEY);
          if (oldData) {
            data = JSON.parse(oldData);
            // Migrate to IndexedDB
            if (data) {
              await saveProjectState(data.elements, data.tracks);
              // Clear old localStorage
              localStorage.removeItem(OLD_STORAGE_KEY);
              console.log('Migrated project from localStorage to IndexedDB');
            }
          }
        }

        if (data && (data.elements.length > 0 || data.tracks.length > 0)) {
          // Restore blob URLs for media elements
          const assets = await getAssets();
          const assetMap = new Map(assets.map(a => [a.id, a]));

          const restoredElements = data.elements.map(el => {
            if ((el as any).assetId) {
              const asset = assetMap.get((el as any).assetId);
              if (asset) {
                return {
                  ...el,
                  props: {
                    ...el.props,
                    src: URL.createObjectURL(asset.blob)
                  }
                };
              }
            }
            return el;
          });

          setProject(prev => ({
            ...prev,
            elements: restoredElements,
            tracks: data.tracks.length > 0 ? data.tracks : DEFAULT_TRACKS
          }));
        }
      } catch (e) {
        console.error('Failed to load project from IndexedDB:', e);
      }
      setIsRestoring(false);
    };

    loadProject();
  }, []);

  // Save to IndexedDB whenever elements or tracks change
  useEffect(() => {
    if (isRestoring) return; // Don't save while restoring

    // Save to IndexedDB (async, non-blocking)
    saveProjectState(project.elements, project.tracks).catch(e => {
      console.error('Failed to save project to IndexedDB:', e);
    });
  }, [project.elements, project.tracks, isRestoring]);

  // Handle Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem('theme', newValue ? 'dark' : 'light');
      return newValue;
    });
  };

  // Handle Playback Timer
  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();

    const updateLoop = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (project.isPlaying) {
        setProject(prev => {
          if (prev.currentTime >= prev.duration) {
            return { ...prev, isPlaying: false, currentTime: 0 };
          }
          return { ...prev, currentTime: prev.currentTime + delta };
        });
        animationFrame = requestAnimationFrame(updateLoop);
      }
    };

    if (project.isPlaying) {
      lastTime = performance.now();
      animationFrame = requestAnimationFrame(updateLoop);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [project.isPlaying, project.duration]);

  const togglePlay = useCallback(() => {
    setProject(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  // Panel resize effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingTimeline) {
        const newHeight = window.innerHeight - e.clientY;
        setTimelineHeight(Math.max(150, Math.min(600, newHeight)));
      }
      if (isResizingLeft) {
        setLeftPanelWidth(Math.max(200, Math.min(450, e.clientX)));
      }
      if (isResizingRight) {
        setRightPanelWidth(Math.max(200, Math.min(450, window.innerWidth - e.clientX)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingTimeline(false);
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    const isResizing = isResizingTimeline || isResizingLeft || isResizingRight;

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingTimeline ? 'ns-resize' : 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingTimeline, isResizingLeft, isResizingRight]);

  // Save current state to history (call before making changes)
  const saveToHistory = useCallback(() => {
    historyManager.push({
      elements: project.elements,
      tracks: project.tracks,
      markers: project.markers
    });
  }, [project.elements, project.tracks, project.markers]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    const previousState = historyManager.undo({
      elements: project.elements,
      tracks: project.tracks,
      markers: project.markers
    });
    if (previousState) {
      setProject(prev => ({
        ...prev,
        elements: previousState.elements,
        tracks: previousState.tracks,
        markers: previousState.markers,
        selectedElementId: null
      }));
    }
  }, [project.elements, project.tracks, project.markers]);

  const handleRedo = useCallback(() => {
    const nextState = historyManager.redo({
      elements: project.elements,
      tracks: project.tracks,
      markers: project.markers
    });
    if (nextState) {
      setProject(prev => ({
        ...prev,
        elements: nextState.elements,
        tracks: nextState.tracks,
        markers: nextState.markers,
        selectedElementId: null
      }));
    }
  }, [project.elements, project.tracks, project.markers]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Undo/Redo: Cmd+Z / Cmd+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Play/Pause: Spacebar
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setProject(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
        return;
      }

      // Split: S
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSplit();
        return;
      }

      // Copy: Cmd+C
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && project.selectedElementId) {
        e.preventDefault();
        const el = project.elements.find(e => e.id === project.selectedElementId);
        if (el) {
          // Basic clipboard impl: Store in localStorage for now since we want internal app copy/paste
          // In a real app we might use navigator.clipboard with custom MIME type but that is complex.
          // Simple App-level clipboard state would use a ref or state, but we are inside useEffect closure.
          // We can use a temporary localStorage key for simplicity to persist across reloads too.
          localStorage.setItem('reactframe_clipboard', JSON.stringify(el));
          // If it has a group, maybe copy whole group? For now, just single element.
        }
        return;
      }

      // Paste: Cmd+V
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        const clipboardData = localStorage.getItem('reactframe_clipboard');
        if (clipboardData) {
          try {
            const elToPaste = JSON.parse(clipboardData) as EditorElement;
            saveToHistory();
            const newId = `${elToPaste.type.toLowerCase()}-${Date.now()}`;
            const newElement: EditorElement = {
              ...elToPaste,
              id: newId,
              name: `${elToPaste.name} Copy`,
              startTime: project.currentTime, // Paste at playhead
              trackId: elToPaste.trackId, // Try to paste on same track
              // Check collision? For now just paste.
              groupId: undefined // Do not paste into old group
            };

            // If track is occupied, simple logic: maybe move to new track or just let it overlap (our engine supports overlap visually but it's messy)
            // Let's just paste.
            setProject(prev => ({
              ...prev,
              elements: [...prev.elements, newElement],
              selectedElementId: newId
            }));
          } catch (err) {
            console.error("Paste failed", err);
          }
        }
        return;
      }

      // Zoom In: + or =
      if ((e.key === '+' || e.key === '=') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPixelsPerSecond(prev => Math.min(prev * 1.2, 500));
        return;
      }

      // Zoom Out: -
      if (e.key === '-' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPixelsPerSecond(prev => Math.max(prev / 1.2, 5));
        return;
      }

      // Delete element: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && project.selectedElementId) {
        e.preventDefault();
        saveToHistory();

        // Group aware delete
        const selectedEl = project.elements.find(el => el.id === project.selectedElementId);
        const idsToDelete = [project.selectedElementId];

        if (selectedEl && selectedEl.groupId) {
          project.elements.forEach(el => {
            if (el.groupId === selectedEl.groupId) {
              idsToDelete.push(el.id);
            }
          });
        }

        setProject(prev => ({
          ...prev,
          elements: prev.elements.filter(el => !idsToDelete.includes(el.id)),
          selectedElementId: null
        }));
        return;
      }

      // Duplicate element: D
      if (e.key === 'd' && project.selectedElementId && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const selectedEl = project.elements.find(el => el.id === project.selectedElementId);
        if (selectedEl) {
          saveToHistory();
          const newElement: EditorElement = {
            ...selectedEl,
            id: `${selectedEl.type.toLowerCase()}-${Date.now()}`,
            name: `${selectedEl.name} Copy`,
            x: Math.min(selectedEl.x + 5, 90),
            y: Math.min(selectedEl.y + 5, 90),
            groupId: undefined // Do not duplicate group membership automatically unless we duplicate whole group
          };
          setProject(prev => ({
            ...prev,
            elements: [...prev.elements, newElement],
            selectedElementId: newElement.id
          }));
        }
        return;
      }

      // Arrow keys: Nudge position
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && project.selectedElementId) {
        e.preventDefault();
        const nudgeAmount = e.shiftKey ? 10 : 1; // Shift for bigger nudge
        setProject(prev => ({
          ...prev,
          elements: prev.elements.map(el => {
            if (el.id !== prev.selectedElementId) return el;
            switch (e.key) {
              case 'ArrowUp': return { ...el, y: Math.max(0, el.y - nudgeAmount) };
              case 'ArrowDown': return { ...el, y: Math.min(100, el.y + nudgeAmount) };
              case 'ArrowLeft': return { ...el, x: Math.max(0, el.x - nudgeAmount) };
              case 'ArrowRight': return { ...el, x: Math.min(100, el.x + nudgeAmount) };
              default: return el;
            }
          })
        }));
        return;
      }


      // Home: Jump to start
      if (e.key === 'Home') {
        e.preventDefault();
        setProject(prev => ({ ...prev, currentTime: 0 }));
        return;
      }

      // End: Jump to end
      if (e.key === 'End') {
        e.preventDefault();
        setProject(prev => ({ ...prev, currentTime: prev.duration }));
        return;
      }

      // J/K/L shuttle control (DaVinci style)
      if (e.key === 'j') {
        // Rewind - go back 5 seconds
        setProject(prev => ({ ...prev, currentTime: Math.max(0, prev.currentTime - 5) }));
        return;
      }
      if (e.key === 'k') {
        // Pause
        setProject(prev => ({ ...prev, isPlaying: false }));
        return;
      }
      if (e.key === 'l') {
        // Forward - go forward 5 seconds or play
        setProject(prev => ({
          ...prev,
          currentTime: Math.min(prev.duration, prev.currentTime + 5),
          isPlaying: true
        }));
        return;
      }
      // Group: Cmd+G
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey && project.selectedElementId) {
        e.preventDefault();
        // Since we only select one at a time currently, grouping needs multi-select which we don't have yet.
        // For now, let's implement a hack: "Group with next touching element" or just placeholder.
        // ACTUALLY, sticking to the plan: "Update selection logic: If clicking a grouped element, select all group members."
        // We need multi-select to form a group first.
        // Let's defer "Group" creation to when we have multi-select or specialized UI.
        // BUT, the plan says "Implement handleGroup...".
        // Let's allow grouping the *currently selected element* into a new group (essentially preparing it).
        // OR better: Since we can't multi-select, maybe we just implement Ungroup for now?
        // Wait, I can implement a "Group All on Track" or similar?
        // No, let's Stick to "Ungroup" for single selection.
        // For Grouping, maybe we assume the user will multi-select in the future?
        // Current constraint: Single selection.
        // Workaround: "Group with overlapping/adjacent" or just leave `handleGroup` empty/stubbed until multi-select exists?
        // Let's implement `handleUngroup` first.
      }

      // Ungroup: Cmd+Shift+G
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && e.shiftKey && project.selectedElementId) {
        e.preventDefault();
        const el = project.elements.find(e => e.id === project.selectedElementId);
        if (el && el.groupId) {
          saveToHistory();
          setProject(prev => ({
            ...prev,
            elements: prev.elements.map(e => e.groupId === el.groupId ? { ...e, groupId: undefined } : e)
          }));
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, project.selectedElementId, project.elements, saveToHistory]);

  // Group helpers
  const handleGroupElements = (elementIds: string[]) => {
    const groupId = Math.random().toString(36).substr(2, 9);
    saveToHistory();
    setProject(prev => ({
      ...prev,
      elements: prev.elements.map(el => elementIds.includes(el.id) ? { ...el, groupId } : el)
    }));
  };

  const handleUngroupElements = (groupId: string) => {
    saveToHistory();
    setProject(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.groupId === groupId ? { ...el, groupId: undefined } : el)
    }));
  };

  const handleSeek = useCallback((time: number) => {
    setProject(prev => ({ ...prev, currentTime: time }));
  }, []);

  const handleUpdateDuration = useCallback((duration: number) => {
    setProject(prev => ({ ...prev, duration: Math.max(duration, prev.duration) }));
  }, []);

  const handleUploadMedia = (file: File, type: ElementType) => {
    const url = URL.createObjectURL(file);
    handleAddElement(type, { src: url, name: file.name });
  };

  const handleAddAssetToTrack = async (assetId: string, trackId: number, startTime: number) => {
    const asset = await getAssetById(assetId);
    if (asset) {
      const url = URL.createObjectURL(asset.blob);
      handleAddElement(asset.type, { src: url, name: asset.name, assetId }, trackId, startTime);
    }
  };

  const handleAddElement = (type: ElementType, customProps?: any, overrideTrackId?: number, overrideStartTime?: number) => {
    const id = Math.random().toString(36).substr(2, 9);

    let defaultProps: ElementProps = {};
    let width = 20;
    let height = 10;
    let name = "New Element";
    let duration = 5;

    // Config based on type
    switch (type) {
      case ElementType.TEXT:
        name = "Text Layer";
        defaultProps = { text: "Double Click Edit", color: isDarkMode ? "#ffffff" : "#000000", fontSize: 24, backgroundColor: "transparent" };
        break;
      case ElementType.SHAPE:
        name = "Rectangle";
        defaultProps = { backgroundColor: "#ef4444", borderRadius: 4, opacity: 1 };
        height = 20;
        break;
      case ElementType.AI_GENERATED:
        name = customProps?.name || "AI Component";
        defaultProps = { ...customProps };
        width = 30; height = 30; // Default size for AI components
        break;
      case ElementType.VIDEO:
        name = customProps?.name || "Video Clip";
        defaultProps = { src: customProps?.src, volume: 1, isMuted: false };
        width = 100; height = 100;
        duration = 10;
        break;
      case ElementType.AUDIO:
        name = customProps?.name || "Audio Track";
        defaultProps = { src: customProps?.src, volume: 1, isMuted: false };
        duration = 30;
        break;
      case ElementType.IMAGE:
        name = customProps?.name || "Image";
        defaultProps = { src: customProps?.src };
        width = 100; height = 100; // Full size by default
        break;
      case ElementType.ADJUSTMENT:
        name = "Adjustment Layer";
        defaultProps = { opacity: 1, brightness: 1, contrast: 1, saturation: 1 };
        width = 100; height = 100; // Full frame
        duration = 10;
        break;
    }

    // Smart Track Logic
    let trackId = 0;

    if (overrideTrackId !== undefined) {
      trackId = overrideTrackId;
    } else {
      // Find free track
      const startTime = overrideStartTime !== undefined ? overrideStartTime : project.currentTime;
      const endTime = startTime + duration;

      let foundTrackId = -1;
      // Sort tracks by ID to check sequentially
      const sortedTracks = [...project.tracks].sort((a, b) => a.id - b.id);

      for (const track of sortedTracks) {
        // Check for overlap on this track
        const hasOverlap = project.elements.some(el =>
          el.trackId === track.id &&
          // Check intersection: (StartA < EndB) and (EndA > StartB)
          (el.startTime < endTime && (el.startTime + el.duration) > startTime)
        );

        if (!hasOverlap) {
          foundTrackId = track.id;
          break;
        }
      }

      if (foundTrackId !== -1) {
        trackId = foundTrackId;
      } else {
        // Create new track if all existing ones are occupied
        const maxId = sortedTracks.length > 0 ? Math.max(...sortedTracks.map(t => t.id)) : -1;
        const newTrackId = maxId + 1;
        const newTrack: Track = {
          id: newTrackId,
          name: `Layer ${newTrackId + 1}`,
          isVisible: true,
          isLocked: false,
          type: 'overlay'
        };

        // We need to update state immediately to reflect new track
        setProject(prev => ({
          ...prev,
          tracks: [...prev.tracks, newTrack]
        }));
        trackId = newTrackId;
      }
    }

    const newElement: EditorElement = {
      id,
      type,
      trackId,
      name,
      startTime: overrideStartTime !== undefined ? overrideStartTime : project.currentTime,
      duration,
      mediaOffset: 0,
      x: type === ElementType.VIDEO || type === ElementType.IMAGE ? 0 : 50 - (width / 2),
      y: type === ElementType.VIDEO || type === ElementType.IMAGE ? 0 : 50 - (height / 2),
      width,
      height,
      rotation: 0,
      zIndex: project.elements.length, // New elements on top
      props: defaultProps,
      ...(customProps?.assetId && { assetId: customProps.assetId })
    } as EditorElement;

    setProject(prev => ({
      ...prev,
      elements: [...prev.elements, newElement],
      selectedElementId: id
    }));
  };

  const handleSelectElement = (id: string | null) => {
    setProject(prev => ({ ...prev, selectedElementId: id }));
  };

  const handleUpdateElement = (id: string, updates: Partial<EditorElement>) => {
    setProject(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } : el)
    }));
  };

  const handleDeleteElement = (id: string) => {
    setProject(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id),
      selectedElementId: null
    }));
  };

  const handleSplit = () => {
    const time = project.currentTime;
    setProject(prev => {
      const newElements = [...prev.elements];
      let modified = false;

      prev.elements.forEach(el => {
        if (time > el.startTime && time < el.startTime + el.duration) {
          if (prev.selectedElementId && el.id !== prev.selectedElementId) return;
          modified = true;
          const splitPointRelative = time - el.startTime;
          const originalDuration = el.duration;
          const leftDuration = splitPointRelative;
          const rightDuration = originalDuration - leftDuration;
          const newId = Math.random().toString(36).substr(2, 9);

          const rightPart: EditorElement = {
            ...el,
            id: newId,
            startTime: time,
            duration: rightDuration,
            mediaOffset: el.mediaOffset + leftDuration,
            name: el.name + " (Copy)"
          };

          const index = newElements.findIndex(e => e.id === el.id);
          newElements[index] = { ...el, duration: leftDuration };
          newElements.push(rightPart);
        }
      });
      return modified ? { ...prev, elements: newElements, selectedElementId: null } : prev;
    });
  };

  // Split Audio from Video - extracts audio to a new track below the video
  const handleSplitAudio = (videoElementId: string) => {
    setProject(prev => {
      const videoElement = prev.elements.find(el => el.id === videoElementId);
      if (!videoElement || videoElement.type !== ElementType.VIDEO) {
        return prev;
      }

      // Find the video's track
      const videoTrackId = videoElement.trackId;

      // Create a new track ID that will be inserted below the video track
      // We need to shift all tracks with id > videoTrackId up by 1
      const newAudioTrackId = videoTrackId + 1;

      // Update existing tracks: shift IDs for tracks below the video track
      const updatedTracks = prev.tracks.map(track => {
        if (track.id > videoTrackId) {
          return { ...track, id: track.id + 1 };
        }
        return track;
      });

      // Update elements on shifted tracks
      const updatedElements = prev.elements.map(el => {
        if (el.trackId > videoTrackId) {
          return { ...el, trackId: el.trackId + 1 };
        }
        return el;
      });

      // Create the new audio track with proper naming
      const newLayerNumber = prev.tracks.length + 1;
      const newAudioTrack: Track = {
        id: newAudioTrackId,
        name: `Layer ${newLayerNumber}`,
        isVisible: true,
        isLocked: false,
        type: 'audio'
      };

      // Insert the new track at the correct position
      const trackIndex = updatedTracks.findIndex(t => t.id > videoTrackId);
      if (trackIndex === -1) {
        updatedTracks.push(newAudioTrack);
      } else {
        updatedTracks.splice(trackIndex, 0, newAudioTrack);
      }

      // Create the audio element with the same timing as the video
      const newAudioId = Math.random().toString(36).substr(2, 9);
      const audioElement: EditorElement = {
        id: newAudioId,
        type: ElementType.AUDIO,
        trackId: newAudioTrackId,
        name: `${videoElement.name} (Audio)`,
        startTime: videoElement.startTime,
        duration: videoElement.duration,
        mediaOffset: videoElement.mediaOffset,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        zIndex: updatedElements.length, // Add zIndex
        props: {
          src: videoElement.props.src,
          volume: videoElement.props.volume ?? 1,
          isMuted: false
        },
        assetId: videoElement.assetId // Preserve asset reference
      };

      // Mute the original video
      const finalElements = updatedElements.map(el => {
        if (el.id === videoElementId) {
          return { ...el, props: { ...el.props, isMuted: true } };
        }
        return el;
      });

      // Add the new audio element
      finalElements.push(audioElement);

      // Sort tracks by ID
      updatedTracks.sort((a, b) => a.id - b.id);

      return {
        ...prev,
        tracks: updatedTracks,
        elements: finalElements,
        selectedElementId: newAudioId // Select the new audio element
      };
    });
  };

  // Insert a new track at a specific position (between tracks)
  const handleInsertTrack = (afterTrackId: number) => {
    setProject(prev => {
      const newTrackId = afterTrackId + 1;

      // Shift all tracks with id > afterTrackId up by 1
      const updatedTracks = prev.tracks.map(track => {
        if (track.id > afterTrackId) {
          return { ...track, id: track.id + 1 };
        }
        return track;
      });

      // Update elements on shifted tracks
      const updatedElements = prev.elements.map(el => {
        if (el.trackId > afterTrackId) {
          return { ...el, trackId: el.trackId + 1 };
        }
        return el;
      });

      // Create the new track with proper naming
      const newLayerNumber = prev.tracks.length + 1;
      const newTrack: Track = {
        id: newTrackId,
        name: `Layer ${newLayerNumber}`,
        isVisible: true,
        isLocked: false,
        type: 'overlay'
      };

      // Insert the new track
      updatedTracks.push(newTrack);
      updatedTracks.sort((a, b) => a.id - b.id);

      return {
        ...prev,
        tracks: updatedTracks,
        elements: updatedElements
      };
    });
  };

  // Delete a track and all its elements
  const handleDeleteTrack = (trackId: number) => {
    setProject(prev => {
      // Don't allow deleting if only one track remains
      if (prev.tracks.length <= 1) {
        return prev;
      }

      // Remove elements on this track
      const remainingElements = prev.elements.filter(el => el.trackId !== trackId);

      // Remove the track
      const remainingTracks = prev.tracks.filter(t => t.id !== trackId);

      // Renormalize track IDs and rename sequentially
      // Sort by current ID first to maintain order
      remainingTracks.sort((a, b) => a.id - b.id);

      const updatedTracks = remainingTracks.map((track, index) => ({
        ...track,
        id: index + 1,
        name: `Layer ${index + 1}`
      }));

      // Create a mapping from old track IDs to new track IDs
      const idMapping = new Map<number, number>();
      remainingTracks.forEach((track, index) => {
        idMapping.set(track.id, index + 1);
      });

      // Update element track IDs using the mapping
      const updatedElements = remainingElements.map(el => ({
        ...el,
        trackId: idMapping.get(el.trackId) ?? el.trackId
      }));

      return {
        ...prev,
        tracks: updatedTracks,
        elements: updatedElements,
        selectedElementId: null
      };
    });
  };

  // Close all gaps between clips - slides clips left to remove empty space
  const handleCloseGaps = () => {
    saveToHistory();
    setProject(prev => {
      // Group elements by track
      const elementsByTrack = new Map<number, EditorElement[]>();
      prev.elements.forEach(el => {
        const trackElements = elementsByTrack.get(el.trackId) || [];
        trackElements.push(el);
        elementsByTrack.set(el.trackId, trackElements);
      });

      // Process each track independently
      const updatedElements = prev.elements.map(el => {
        const trackElements = elementsByTrack.get(el.trackId) || [];
        // Sort elements on this track by start time
        const sorted = [...trackElements].sort((a, b) => a.startTime - b.startTime);

        // Find this element's position in the sorted list
        const index = sorted.findIndex(e => e.id === el.id);

        if (index === 0) {
          // First element on track - move to time 0
          return { ...el, startTime: 0 };
        } else {
          // Calculate new start time based on previous element's end
          const prevElement = sorted[index - 1];
          const prevEnd = prevElement.startTime + prevElement.duration;

          // Only move if there's a gap
          if (el.startTime > prevEnd) {
            // But we need to recalculate based on potentially moved previous elements
            // For a proper implementation, we do this in order
            let newStartTime = 0;
            for (let i = 0; i < index; i++) {
              newStartTime += sorted[i].duration;
            }
            return { ...el, startTime: newStartTime };
          }
          return el;
        }
      });

      return {
        ...prev,
        elements: updatedElements
      };
    });
  };

  // Timeline Markers Handlers
  const handleAddMarker = (time: number) => {
    const newMarker: Marker = {
      id: Math.random().toString(36).substr(2, 9),
      time,
      name: 'Marker',
      color: 'blue'
    };
    saveToHistory();
    setProject(prev => ({
      ...prev,
      markers: [...prev.markers, newMarker].sort((a, b) => a.time - b.time)
    }));
  };

  const handleUpdateMarker = (id: string, updates: Partial<Marker>) => {
    saveToHistory();
    setProject(prev => ({
      ...prev,
      markers: prev.markers.map(m => m.id === id ? { ...m, ...updates } : m).sort((a, b) => a.time - b.time)
    }));
  };

  const handleDeleteMarker = (id: string) => {
    saveToHistory();
    setProject(prev => ({
      ...prev,
      markers: prev.markers.filter(m => m.id !== id)
    }));
  };

  const handleExport = () => {
    setIsExportModalOpen(true);
  };

  const startExport = async (filename: string, fps: number) => {
    setIsExportModalOpen(false);
    if (!previewRef.current) return;

    // Safety check just in case modal didn't close or something
    if (!confirm(`Start recording playback for "${filename}" at ${fps} FPS? The video will play from start to finish.`)) return;

    try {
      setProject(prev => ({ ...prev, currentTime: 0, isPlaying: true }));
      const stream = previewRef.current.captureStream(fps);
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.webm`;
        a.click();
        setProject(prev => ({ ...prev, isPlaying: false }));
      };

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
      }, project.duration * 1000);

    } catch (e) {
      console.error(e);
      alert("Browser does not support capturing this stream directly.");
    }
  };

  // ==================== SAVE/LOAD PROJECT FILE HANDLERS ====================

  /**
   * Save the current project to a downloadable .motionlabs file
   * This file can be shared and opened on any device
   */
  const handleSaveProject = async () => {
    try {
      await saveProjectToFile(
        project.elements,
        project.tracks,
        project.markers,
        'motion-labs-project'
      );
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project. Please try again.');
    }
  };

  /**
   * Load a project from a .motionlabs file
   * Replaces the current project with the loaded one
   */
  const handleLoadProject = async () => {
    // Confirm before loading (will replace current project)
    if (project.elements.length > 0) {
      const confirmed = confirm(
        'Loading a project will replace your current work. Continue?'
      );
      if (!confirmed) return;
    }

    try {
      const loadedProject = await openProjectFilePicker();
      if (loadedProject) {
        // Save current state to history before replacing
        saveToHistory();

        // Update project with loaded data
        setProject(prev => ({
          ...prev,
          elements: loadedProject.elements,
          tracks: loadedProject.tracks.length > 0 ? loadedProject.tracks : DEFAULT_TRACKS,
          markers: loadedProject.markers || [],
          selectedElementId: null,
          currentTime: 0
        }));

        // Also save to IndexedDB for persistence
        await saveProjectState(loadedProject.elements, loadedProject.tracks);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      alert('Failed to load project. Please ensure the file is valid.');
    }
  };

  const selectedElement = project.elements.find(el => el.id === project.selectedElementId) || null;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black text-gray-900 dark:text-white transition-colors duration-200">
      {/* Header */}
      <header className="h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 justify-between z-50 transition-colors">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-md">
            <LayersIcon className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">Motion <span className="text-blue-600 dark:text-blue-500">Labs</span></h1>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
            {isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowKeyboardShortcuts(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
            title="Keyboard Shortcuts"
          >
            <span className="text-sm">⌨️</span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Settings
          </button>
          {/* Save/Load Project Buttons */}
          <button
            onClick={handleSaveProject}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center space-x-1.5"
            title="Save project to file (.motionlabs)"
          >
            <SaveIcon className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
          <button
            onClick={handleLoadProject}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center space-x-1.5"
            title="Load project from file (.motionlabs)"
          >
            <FolderOpenIcon className="w-3.5 h-3.5" />
            <span>Load</span>
          </button>
          <div className="text-xs text-gray-500 dark:text-gray-500">v2.3-save-load</div>
          <button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 px-4 py-1.5 rounded text-xs font-semibold transition flex items-center space-x-2 text-white shadow-sm"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Assets Panel with resize handle */}
        <div className="flex-shrink-0 relative" style={{ width: `${leftPanelWidth}px` }}>
          <AssetsPanel
            onAddElement={handleAddElement}
            onUploadMedia={handleUploadMedia}
            panelWidth={leftPanelWidth}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
          {/* Right edge resize handle */}
          <div
            className="absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize z-30 hover:bg-blue-500/50 transition-colors group"
            onMouseDown={() => setIsResizingLeft(true)}
          >
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-500 transition-colors" />
          </div>
        </div>

        {/* Center: Preview */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 relative transition-colors min-w-0">
          <VideoPreview
            ref={previewRef}
            currentTime={project.currentTime}
            isPlaying={project.isPlaying}
            elements={project.elements}
            selectedElementId={project.selectedElementId}
            onSelectElement={handleSelectElement}
            onUpdateElement={handleUpdateElement}
            onTimeUpdate={handleSeek}
            onDurationChange={handleUpdateDuration}
            togglePlay={togglePlay}
          />
        </div>

        {/* Right: Properties Panel with resize handle */}
        <div className="flex-shrink-0 relative" style={{ width: `${rightPanelWidth}px` }}>
          {/* Left edge resize handle */}
          <div
            className="absolute top-0 left-0 bottom-0 w-1 cursor-ew-resize z-30 hover:bg-blue-500/50 transition-colors group"
            onMouseDown={() => setIsResizingRight(true)}
          >
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-500 transition-colors" />
          </div>
          <PropertiesPanel
            element={selectedElement}
            onUpdate={handleUpdateElement}
            onDelete={handleDeleteElement}
            onSplitAudio={handleSplitAudio}
            panelWidth={rightPanelWidth}
          />
        </div>
      </div>

      {/* Bottom: Timeline */}
      <div
        className="flex-shrink-0 z-40 relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]"
        style={{ height: `${timelineHeight}px` }}
      >
        {/* Resize Handle */}
        <div
          className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-50 group"
          onMouseDown={() => setIsResizingTimeline(true)}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-transparent group-hover:bg-blue-500/50 transition-colors" />
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-12 h-1 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-500 transition-colors" />
        </div>

        <Timeline
          tracks={project.tracks}
          elements={project.elements}
          currentTime={project.currentTime}
          duration={project.duration}
          onSeek={handleSeek}
          onSelectElement={handleSelectElement}
          selectedElementId={project.selectedElementId}
          onUpdateElement={handleUpdateElement}
          onSplit={handleSplit}
          pixelsPerSecond={pixelsPerSecond}
          setPixelsPerSecond={setPixelsPerSecond}
          onAddAsset={handleAddAssetToTrack}
          onInsertTrack={handleInsertTrack}
          onDeleteTrack={handleDeleteTrack}
          rippleEditMode={rippleEditMode}
          onToggleRippleEdit={() => setRippleEditMode(!rippleEditMode)}
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled(!snapEnabled)}
          onCloseGaps={handleCloseGaps}
          markers={project.markers}
          onAddMarker={handleAddMarker}
          onUpdateMarker={handleUpdateMarker}
          onDeleteMarker={handleDeleteMarker}
        />
      </div>

      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={startExport}
        duration={project.duration}
      />
    </div>
  );
}

export default App;
