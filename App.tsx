import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LayersIcon, DownloadIcon, SunIcon, MoonIcon, SaveIcon, FolderOpenIcon } from './components/ui/Icons';
import AssetsPanel from './components/panels/AssetsPanel';
import SettingsPanel from './components/panels/SettingsPanel';
import PropertiesPanel from './components/panels/PropertiesPanel';
import ColorPanel from './components/panels/ColorPanel';
import SourceMonitorPanel, { SourceClip } from './components/panels/SourceMonitorPanel';
import EffectsPanel from './components/panels/EffectsPanel';
import AudioMixerPanel from './components/panels/AudioMixerPanel';
import VideoPreview, { VideoPreviewHandle } from './components/preview/VideoPreview';
import Timeline from './components/timeline/Timeline';
import MenuBar from './components/ui/MenuBar';
import ToolsPanel from './components/ui/ToolsPanel';
import type { ToolMode } from './components/ui/ToolsPanel';
import { ProjectState, Track, EditorElement, ElementType, ElementProps, Marker } from './types';
import { DEFAULT_TRACKS, INITIAL_DURATION, PIXELS_PER_SECOND_DEFAULT, TIMELINE_TRACK_HEADER_WIDTH } from './constants';
import { getAssetById, getAssets, saveProjectState, loadProjectState } from './utils/db';
import { saveProjectToFile, openProjectFilePicker } from './utils/projectFile';
import { historyManager, HistoryState } from './utils/history';
import KeyboardShortcutsModal from './components/ui/KeyboardShortcutsModal';
import ExportModal from './components/ui/ExportModal';
import { exportProjectVideo, getExportPresets, getSupportedExportFormats, type ExportOptions } from './utils/exportVideo';

const OLD_STORAGE_KEY = 'reactframe_project'; // For migration from localStorage
const DEFAULT_PREVIEW_ASPECT_RATIO = 16 / 9;

function App() {
  const MIN_SIDE_PANEL_WIDTH = 240;
  const MAX_SIDE_PANEL_WIDTH = 520;
  const MIN_PREVIEW_WIDTH = 360;
  const MIN_TIMELINE_CONTENT_WIDTH = TIMELINE_TRACK_HEADER_WIDTH + 360;
  const MIN_TIMELINE_HEIGHT = 180;
  const MIN_WORKSPACE_HEIGHT = 240;

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const appRef = useRef<HTMLDivElement>(null);
  const desktopWorkspaceRef = useRef<HTMLDivElement>(null);
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
  const [topLeftPanelWidth, setTopLeftPanelWidth] = useState(500);
  const [bottomLeftPanelWidth, setBottomLeftPanelWidth] = useState(340);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [isResizingTopLeft, setIsResizingTopLeft] = useState(false);
  const [isResizingBottomLeft, setIsResizingBottomLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [rippleEditMode, setRippleEditMode] = useState(false); // DaVinci-style ripple edit
  const [snapEnabled, setSnapEnabled] = useState(true); // Magnetic snap toggle
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'source' | 'properties' | 'color'>('source');
  const [activeLeftBottomTab, setActiveLeftBottomTab] = useState<'project' | 'effects'>('project');
  const [sourceClip, setSourceClip] = useState<SourceClip | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'timeline' | 'assets' | 'properties'>('timeline');
  const [toolMode, setToolMode] = useState<ToolMode>('pointer');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [previewAspectRatio, setPreviewAspectRatio] = useState('16:9');
  const exportPresets = getExportPresets();
  const supportedExportFormats = getSupportedExportFormats();

  const parseAspectRatio = (ratio: string) => {
    const [width, height] = ratio.split(':').map(Number);
    if (!width || !height) return DEFAULT_PREVIEW_ASPECT_RATIO;
    return width / height;
  };

  const fitMediaToFrame = (sourceAspectRatio: number, frameAspectRatio: number) => {
    if (sourceAspectRatio >= frameAspectRatio) {
      return {
        width: 100,
        height: (frameAspectRatio / sourceAspectRatio) * 100
      };
    }

    return {
      width: (sourceAspectRatio / frameAspectRatio) * 100,
      height: 100
    };
  };

  const getMediaFrameLayout = (
    sourceAspectRatio: number,
    frameAspectRatio: number,
    fitMode: ElementProps['mediaFitMode'] = 'fit'
  ) => {
    if (fitMode === 'fill' || fitMode === 'stretch') {
      return {
        width: 100,
        height: 100,
        x: 0,
        y: 0
      };
    }

    const fitted = fitMediaToFrame(sourceAspectRatio, frameAspectRatio);
    return {
      width: fitted.width,
      height: fitted.height,
      x: (100 - fitted.width) / 2,
      y: (100 - fitted.height) / 2
    };
  };

  const applyPreviewAspectRatio = useCallback((ratio: string) => {
    const frameAspectRatio = parseAspectRatio(ratio);
    setPreviewAspectRatio(ratio);
    setProject(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (
          (el.type !== ElementType.VIDEO && el.type !== ElementType.IMAGE) ||
          !el.props.sourceAspectRatio
        ) {
          return el;
        }
        const layout = getMediaFrameLayout(
          el.props.sourceAspectRatio,
          frameAspectRatio,
          el.props.mediaFitMode
        );
        return {
          ...el,
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height
        };
      })
    }));
  }, []);

  const resetSelectedMediaToFrame = useCallback((ratio?: string) => {
    const targetRatio = parseAspectRatio(ratio || previewAspectRatio);

    setProject(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (
          el.id !== prev.selectedElementId ||
          (el.type !== ElementType.VIDEO && el.type !== ElementType.IMAGE) ||
          !el.props.sourceAspectRatio
        ) {
          return el;
        }

        const layout = getMediaFrameLayout(
          el.props.sourceAspectRatio,
          targetRatio,
          el.props.mediaFitMode
        );

        return {
          ...el,
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
          rotation: 0
        };
      })
    }));
  }, [previewAspectRatio]);

  const normalizeTrackTypes = useCallback((tracks: Track[]) => {
    const normalizedTracks = tracks.map(track => ({
      ...track,
      type: track.type === 'overlay' ? 'video' : track.type
    }));

    const videoTracks = normalizedTracks.filter(track => track.type === 'video').sort((a, b) => a.id - b.id);
    const audioTracks = normalizedTracks.filter(track => track.type === 'audio').sort((a, b) => a.id - b.id);
    const videoNameMap = new Map(videoTracks.map((track, index) => [track.id, `Video ${index + 1}`]));
    const audioNameMap = new Map(audioTracks.map((track, index) => [track.id, `Audio ${index + 1}`]));

    return normalizedTracks.map(track => ({
      ...track,
      name: track.type === 'audio'
        ? (audioNameMap.get(track.id) || track.name)
        : (videoNameMap.get(track.id) || track.name)
    }));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [project, setProject] = useState<ProjectState>({
    currentTime: 0,
    duration: INITIAL_DURATION,
    isPlaying: false,
    zoomLevel: 1,
    elements: [],
    tracks: normalizeTrackTypes(DEFAULT_TRACKS),
    markers: [], // Timeline markers
    selectedElementId: null,
    selectedElementIds: [],
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
            tracks: normalizeTrackTypes(data.tracks.length > 0 ? data.tracks : DEFAULT_TRACKS)
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
      const workspaceRect = desktopWorkspaceRef.current?.getBoundingClientRect();
      const appRect = appRef.current?.getBoundingClientRect();

      if (isResizingTimeline && appRect && workspaceRect) {
        const maxTimelineHeight = Math.max(
          MIN_TIMELINE_HEIGHT,
          appRect.bottom - workspaceRect.top - MIN_WORKSPACE_HEIGHT
        );
        const newHeight = clamp(appRect.bottom - e.clientY, MIN_TIMELINE_HEIGHT, maxTimelineHeight);
        setTimelineHeight(newHeight);
      }

      if (workspaceRect) {
        if (isResizingTopLeft) {
          const maxLeftWidth = workspaceRect.width - MIN_PREVIEW_WIDTH;
          const newWidth = clamp(e.clientX - workspaceRect.left, MIN_SIDE_PANEL_WIDTH, maxLeftWidth);
          setTopLeftPanelWidth(newWidth);
        }

        if (isResizingBottomLeft) {
          const maxLeftWidth = workspaceRect.width - MIN_TIMELINE_CONTENT_WIDTH;
          const newWidth = clamp(e.clientX - workspaceRect.left, MIN_SIDE_PANEL_WIDTH, maxLeftWidth);
          setBottomLeftPanelWidth(newWidth);
        }

        if (isResizingRight) {
          // Keep right resize logic if any right panels exist, otherwise it's a no-op
          const maxRightWidth = workspaceRect.width - MIN_PREVIEW_WIDTH;
          const newWidth = clamp(workspaceRect.right - e.clientX, MIN_SIDE_PANEL_WIDTH, maxRightWidth);
          setRightPanelWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingTimeline(false);
      setIsResizingTopLeft(false);
      setIsResizingBottomLeft(false);
      setIsResizingRight(false);
    };

    const isResizing = isResizingTimeline || isResizingTopLeft || isResizingBottomLeft || isResizingRight;

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
  }, [isResizingTimeline, isResizingTopLeft, isResizingBottomLeft, isResizingRight]);

  useEffect(() => {
    if (isMobile) return;

    const syncDesktopPanelBounds = () => {
      const workspaceRect = desktopWorkspaceRef.current?.getBoundingClientRect();
      const appRect = appRef.current?.getBoundingClientRect();

      if (workspaceRect) {
        const maxLeftWidth = workspaceRect.width - MIN_PREVIEW_WIDTH;
        const maxRightWidth = workspaceRect.width - MIN_PREVIEW_WIDTH;
        const maxBottomLeftWidth = workspaceRect.width - MIN_TIMELINE_CONTENT_WIDTH;

        setTopLeftPanelWidth(prev => clamp(prev, MIN_SIDE_PANEL_WIDTH, maxLeftWidth));
        setBottomLeftPanelWidth(prev => clamp(prev, MIN_SIDE_PANEL_WIDTH, maxBottomLeftWidth));
        setRightPanelWidth(prev => clamp(prev, MIN_SIDE_PANEL_WIDTH, maxRightWidth));
      }

      if (workspaceRect && appRect) {
        const maxTimelineHeight = Math.max(
          MIN_TIMELINE_HEIGHT,
          appRect.bottom - workspaceRect.top - MIN_WORKSPACE_HEIGHT
        );
        setTimelineHeight(prev => clamp(prev, MIN_TIMELINE_HEIGHT, maxTimelineHeight));
      }
    };

    syncDesktopPanelBounds();
    window.addEventListener('resize', syncDesktopPanelBounds);
    return () => window.removeEventListener('resize', syncDesktopPanelBounds);
  }, [isMobile]);

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

      // Tool selection shortcuts (match Premiere Pro)
      const toolShortcuts: Record<string, ToolMode> = {
        'v': 'pointer',
        'a': 'track-select',
        'b': 'ripple-edit',
        'y': 'slip',
        'u': 'slide',
        'n': 'roll',
        'x': 'rate-stretch',
        'p': 'pen',
        'h': 'hand',
        'z': 'zoom',
        't': 'type',
      };
      const toolKey = e.key.toLowerCase();
      if (toolKey === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSplit();
        setToolMode('pointer');
        return;
      }
      if (toolShortcuts[toolKey] && !e.metaKey && !e.ctrlKey) {
        setToolMode(toolShortcuts[toolKey]);
        return;
      }

      // Split: S (Command)
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

      if ((e.key === '+' || e.key === '=') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPixelsPerSecond(prev => Math.min(prev * 1.2, 2000));
        return;
      }

      if (e.key === '-' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPixelsPerSecond(prev => Math.max(prev / 1.2, 0.5));
        return;
      }

      // Delete element: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && project.selectedElementId) {
        e.preventDefault();
        saveToHistory();

        setProject(prev => ({
          ...prev,
          elements: prev.elements.filter(el => el.id !== project.selectedElementId),
          selectedElementId: null,
          selectedElementIds: []
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        if (project.selectedElementIds.length > 1) {
          handleGroupElements(project.selectedElementIds);
        } else if (project.selectedElementId) {
          // Fallback: If single element selected, try to find continuous block on same track?
          // Or just do nothing. Standard behavior is to need selection.
          // Maybe select all on track? No, that's Cmd+A.
          console.log("Select multiple elements to group.");
        }
        return;
      }

      // Ungroup: Cmd+Shift+G
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && e.shiftKey && project.selectedElementId) {
        e.preventDefault();
        const el = project.elements.find(e => e.id === project.selectedElementId);
        if (el && el.groupId) {
          handleUngroupElements(el.groupId);
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

  const loadMediaDimensions = (src: string, type: ElementType): Promise<{ width: number; height: number } | null> => {
    if (type === ElementType.IMAGE) {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }

    if (type === ElementType.VIDEO) {
      return new Promise(resolve => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
        video.onerror = () => resolve(null);
        video.src = src;
      });
    }

    return Promise.resolve(null);
  };

  const loadMediaDuration = (src: string, type: ElementType): Promise<number | null> => {
    if (type !== ElementType.AUDIO && type !== ElementType.VIDEO) {
      return Promise.resolve(null);
    }

    return new Promise(resolve => {
      const media = document.createElement(type === ElementType.AUDIO ? 'audio' : 'video');
      media.preload = 'auto'; // Use 'auto' instead of 'metadata' to ensure full duration is available

      let resolved = false;
      const tryResolve = () => {
        if (resolved) return;
        const d = media.duration;
        if (Number.isFinite(d) && d > 0) {
          resolved = true;
          resolve(d);
        }
      };

      media.onloadedmetadata = tryResolve;
      media.ondurationchange = tryResolve; // Some formats report duration later
      media.oncanplaythrough = tryResolve; // Fallback: once fully buffered
      media.onerror = () => { if (!resolved) { resolved = true; resolve(null); } };

      // Timeout safety: if duration not available after 10s, resolve null
      setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 10000);

      media.src = src;
    });
  };

  const handleAddAssetToTrack = async (assetId: string, trackId: number, startTime: number) => {
    const asset = await getAssetById(assetId);
    if (asset) {
      const url = URL.createObjectURL(asset.blob);
      handleAddElement(asset.type, { src: url, name: asset.name, assetId }, trackId, startTime);
    }
  };

  const loadVideoMetadata = (src: string): Promise<{ duration: number | null; width: number | null; height: number | null; hasAudio: boolean }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        const hasAudio =
          Boolean((video as any).mozHasAudio) ||
          (((video as any).webkitAudioDecodedByteCount ?? 0) > 0) ||
          (((video as any).audioTracks?.length ?? 0) > 0);

        resolve({
          duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null,
          width: video.videoWidth || null,
          height: video.videoHeight || null,
          hasAudio
        });
      };

      video.preload = 'metadata';
      video.muted = true;
      video.src = src;
      video.onloadedmetadata = finish;
      video.oncanplay = finish;
      video.onerror = finish;
      setTimeout(finish, 4000);
    });
  };

  const createTrackRecord = (id: number, type: Track['type']): Track => ({
    id,
    name: type === 'audio' ? 'Audio' : 'Video',
    isVisible: true,
    isLocked: false,
    type
  });

  const isTrackTypeCompatible = (track: Track, desiredType: Track['type']) => {
    if (desiredType === 'audio') return track.type === 'audio';
    return track.type !== 'audio';
  };

  const findAvailableTrackId = (
    tracks: Track[],
    elements: EditorElement[],
    desiredType: Track['type'],
    startTime: number,
    duration: number,
    preferredTrackId?: number
  ) => {
    const endTime = startTime + duration;

    if (preferredTrackId !== undefined) {
      const preferredTrack = tracks.find(track => track.id === preferredTrackId);
      if (preferredTrack && isTrackTypeCompatible(preferredTrack, desiredType)) {
        return preferredTrackId;
      }
    }

    const compatibleTracks = [...tracks]
      .filter(track => isTrackTypeCompatible(track, desiredType))
      .sort((a, b) => a.id - b.id);

    for (const track of compatibleTracks) {
      const hasOverlap = elements.some(el =>
        el.trackId === track.id &&
        (el.startTime < endTime && (el.startTime + el.duration) > startTime)
      );

      if (!hasOverlap) {
        return track.id;
      }
    }

    return null;
  };

  const handleAddElement = async (type: ElementType, customProps?: any, overrideTrackId?: number, overrideStartTime?: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    const startTime = overrideStartTime !== undefined ? overrideStartTime : project.currentTime;
    const tracksSnapshot = [...project.tracks].sort((a, b) => a.id - b.id);
    const elementsSnapshot = [...project.elements];

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
        defaultProps = { src: customProps?.src, volume: 1, isMuted: false, mediaFitMode: 'fit' };
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
        defaultProps = { src: customProps?.src, mediaFitMode: 'fit' };
        width = 100; height = 100; // Full size by default
        break;
      case ElementType.ADJUSTMENT:
        name = "Adjustment Layer";
        defaultProps = { opacity: 1, brightness: 1, contrast: 1, saturation: 1 };
        width = 100; height = 100; // Full frame
        duration = 10;
        break;
    }

    let videoHasAudio = false;
    if (type === ElementType.VIDEO && customProps?.src) {
      const metadata = await loadVideoMetadata(customProps.src);
      if (metadata.duration) duration = metadata.duration;
      if (metadata.width && metadata.height) {
        const sourceAspectRatio = metadata.width / metadata.height;
        const layout = getMediaFrameLayout(
          sourceAspectRatio,
          parseAspectRatio(previewAspectRatio),
          defaultProps.mediaFitMode
        );
        width = layout.width;
        height = layout.height;
        defaultProps = {
          ...defaultProps,
          sourceWidth: metadata.width,
          sourceHeight: metadata.height,
          sourceAspectRatio,
          mediaZoom: 1
        };
      }
      videoHasAudio = customProps?.forceLinkedAudio ?? true;
    } else if (type === ElementType.IMAGE && customProps?.src) {
      const dimensions = await loadMediaDimensions(customProps.src, type);
      if (dimensions?.width && dimensions?.height) {
        const sourceAspectRatio = dimensions.width / dimensions.height;
        const layout = getMediaFrameLayout(
          sourceAspectRatio,
          parseAspectRatio(previewAspectRatio),
          defaultProps.mediaFitMode
        );
        width = layout.width;
        height = layout.height;

        defaultProps = {
          ...defaultProps,
          sourceWidth: dimensions.width,
          sourceHeight: dimensions.height,
          sourceAspectRatio,
          mediaZoom: 1
        };
      }
    } else if (type === ElementType.AUDIO && customProps?.src) {
      const mediaDuration = await loadMediaDuration(customProps.src, type);
      if (mediaDuration) duration = mediaDuration;
    }

    const desiredTrackType: Track['type'] = type === ElementType.AUDIO ? 'audio' : 'video';
    let trackId = findAvailableTrackId(tracksSnapshot, elementsSnapshot, desiredTrackType, startTime, duration, overrideTrackId);
    const tracksToAdd: Track[] = [];

    if (trackId === null) {
      trackId = (tracksSnapshot.length > 0 ? Math.max(...tracksSnapshot.map(t => t.id)) : -1) + 1;
      tracksToAdd.push(createTrackRecord(trackId, desiredTrackType));
    }

    const newElements: EditorElement[] = [{
      id,
      type,
      trackId,
      name,
      startTime,
      duration,
      mediaOffset: 0,
      x: type === ElementType.VIDEO || type === ElementType.IMAGE ? (100 - width) / 2 : 50 - (width / 2),
      y: type === ElementType.VIDEO || type === ElementType.IMAGE ? (100 - height) / 2 : 50 - (height / 2),
      width,
      height,
      rotation: 0,
      zIndex: project.elements.length,
      lockAspectRatio: type === ElementType.VIDEO || type === ElementType.IMAGE,
      props: defaultProps,
      ...(customProps?.assetId && { assetId: customProps.assetId })
    } as EditorElement];

    if (type === ElementType.VIDEO && customProps?.src && videoHasAudio) {
      let audioTrackId = findAvailableTrackId(
        [...tracksSnapshot, ...tracksToAdd],
        [...elementsSnapshot, ...newElements],
        'audio',
        startTime,
        duration
      );

      if (audioTrackId === null) {
        audioTrackId = ([...tracksSnapshot, ...tracksToAdd].length > 0 ? Math.max(...[...tracksSnapshot, ...tracksToAdd].map(t => t.id)) : -1) + 1;
        tracksToAdd.push(createTrackRecord(audioTrackId, 'audio'));
      }

      const groupId = Math.random().toString(36).substr(2, 9);
      newElements[0] = {
        ...newElements[0],
        groupId,
        props: {
          ...newElements[0].props,
          isMuted: true
        }
      };

      newElements.push({
        id: Math.random().toString(36).substr(2, 9),
        type: ElementType.AUDIO,
        trackId: audioTrackId,
        name: `${name} (Audio)`,
        startTime,
        duration,
        mediaOffset: 0,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        zIndex: project.elements.length + 1,
        groupId,
        props: {
          src: customProps.src,
          volume: 1,
          isMuted: false
        },
        ...(customProps?.assetId && { assetId: customProps.assetId })
      });
    }

    setProject(prev => ({
      ...prev,
      tracks: tracksToAdd.length > 0 ? normalizeTrackTypes([...prev.tracks, ...tracksToAdd].sort((a, b) => a.id - b.id)) : prev.tracks,
      duration: Math.max(prev.duration, ...newElements.map(element => element.startTime + element.duration)),
      elements: [...prev.elements, ...newElements],
      selectedElementId: newElements[0].id,
      selectedElementIds: newElements[0].groupId ? newElements.map(element => element.id) : [newElements[0].id]
    }));
  };

  const handleSelectElement = (id: string | null) => {
    setProject(prev => ({
      ...prev,
      selectedElementId: id,
      selectedElementIds: id ? [id] : []
    }));
  };

  const handleToggleSelectElement = (id: string) => {
    setProject(prev => {
      const isSelected = prev.selectedElementIds.includes(id);
      let newIds: string[];
      let newPrimary = prev.selectedElementId;

      if (isSelected) {
        newIds = prev.selectedElementIds.filter(eid => eid !== id);
        if (newPrimary === id) {
          newPrimary = newIds.length > 0 ? newIds[newIds.length - 1] : null;
        }
      } else {
        newIds = [...prev.selectedElementIds, id];
        newPrimary = id;
      }

      return {
        ...prev,
        selectedElementId: newPrimary,
        selectedElementIds: newIds
      };
    });
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
      selectedElementId: null,
      selectedElementIds: []
    }));
  };

  const handleSplit = () => {
    const time = project.currentTime;
    setProject(prev => {
      const newElements = [...prev.elements];
      let modified = false;

      prev.elements.forEach(el => {
        if (time > el.startTime && time < el.startTime + el.duration) {
          // If selection exists, only split selected elements.
          // If no selection, split all elements under playhead (Razor/Blade behavior).
          if (prev.selectedElementIds.length > 0) {
            if (!prev.selectedElementIds.includes(el.id)) return;
          }

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
            name: el.name + " (Copy)",
            groupId: undefined
          };

          const index = newElements.findIndex(e => e.id === el.id);
          newElements[index] = { ...el, duration: leftDuration, groupId: undefined };
          newElements.push(rightPart);
        }
      });
      return modified
        ? {
          ...prev,
          elements: newElements,
          selectedElementId: null,
          selectedElementIds: []
        }
        : prev;
    });
  };

  const handleSplitElement = useCallback((elementId: string, time: number) => {
    saveToHistory();
    setProject(prev => {
      const el = prev.elements.find(e => e.id === elementId);
      if (!el || time <= el.startTime || time >= el.startTime + el.duration) return prev;

      const splitPointRelative = time - el.startTime;
      const leftDuration = splitPointRelative;
      const rightDuration = el.duration - leftDuration;
      const newId = Math.random().toString(36).substr(2, 9);

      const rightPart: EditorElement = {
        ...el,
        id: newId,
        startTime: time,
        duration: rightDuration,
        mediaOffset: el.mediaOffset + leftDuration,
        name: el.name + " (Copy)",
        groupId: undefined
      };

      const newElements = prev.elements.map(e => e.id === el.id ? { ...e, duration: leftDuration, groupId: undefined } : e);
      newElements.push(rightPart);
      return { ...prev, elements: newElements };
    });
  }, [saveToHistory]);

  const handleBladeAction = useCallback(() => {
    handleSplit();
    setToolMode('pointer');
  }, [handleSplit]);

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
        name: `Audio ${newLayerNumber}`,
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
        name: `Video ${newLayerNumber}`,
        isVisible: true,
        isLocked: false,
        type: 'video'
      };

      // Insert the new track
      updatedTracks.push(newTrack);
      updatedTracks.sort((a, b) => a.id - b.id);

      return {
        ...prev,
        tracks: normalizeTrackTypes(updatedTracks),
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
        tracks: normalizeTrackTypes(updatedTracks),
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

  const handleCloseGap = (trackId: number, gapStart: number, gapEnd: number) => {
    const gapDuration = Math.max(0, gapEnd - gapStart);
    if (gapDuration <= 0) return;

    saveToHistory();
    setProject(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.trackId !== trackId || el.startTime < gapEnd) {
          return el;
        }
        return {
          ...el,
          startTime: Math.max(gapStart, el.startTime - gapDuration)
        };
      })
    }));
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

  const startExport = async (options: ExportOptions) => {
    if (supportedExportFormats.length === 0) {
      alert('This browser does not support video export with MediaRecorder.');
      return;
    }

    try {
      setProject(prev => ({ ...prev, isExporting: true, isPlaying: false, currentTime: 0 }));
      await exportProjectVideo({
        elements: project.elements,
        duration: project.duration,
        aspectRatio: previewAspectRatio,
        options,
        onProgress: (currentTime) => {
          setProject(prev => ({ ...prev, currentTime }));
        }
      });
      setIsExportModalOpen(false);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setProject(prev => ({ ...prev, isExporting: false, isPlaying: false }));
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
          tracks: normalizeTrackTypes(loadedProject.tracks.length > 0 ? loadedProject.tracks : DEFAULT_TRACKS),
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
    <div ref={appRef} className="flex h-screen flex-col overflow-hidden bg-pp-darkest text-pp-text">
      {/* Premiere Pro Menu Bar */}
      <MenuBar
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
        onExport={handleExport}
        onShowShortcuts={() => setShowKeyboardShortcuts(true)}
      />

      {isMobile ? (
        /* ========================= MOBILE LAYOUT ========================= */
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile Tab Bar */}
          <div className="flex h-10 border-b border-black/30 bg-pp-dark z-10 shrink-0">
            <button
              onClick={() => setActiveMobileTab('timeline')}
              className={`flex-1 text-[11px] font-medium transition-colors ${activeMobileTab === 'timeline' ? 'text-pp-accent border-b-2 border-pp-accent' : 'text-pp-text-dim'}`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveMobileTab('assets')}
              className={`flex-1 text-[11px] font-medium transition-colors ${activeMobileTab === 'assets' ? 'text-pp-accent border-b-2 border-pp-accent' : 'text-pp-text-dim'}`}
            >
              Project
            </button>
            <button
              onClick={() => setActiveMobileTab('properties')}
              className={`flex-1 text-[11px] font-medium transition-colors ${activeMobileTab === 'properties' ? 'text-pp-accent border-b-2 border-pp-accent' : 'text-pp-text-dim'}`}
            >
              Properties
            </button>
          </div>

          {/* Mobile Preview */}
          <div className="h-[40vh] shrink-0 border-b border-black/30 flex flex-col bg-pp-darkest relative min-w-0">
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
              aspectRatio={previewAspectRatio}
              onAspectRatioChange={applyPreviewAspectRatio}
              onResetSelectedMediaToFrame={resetSelectedMediaToFrame}
              duration={project.duration}
            />
          </div>

          {activeMobileTab === 'assets' && (
            <div className="flex-1 overflow-hidden bg-pp-dark">
              <AssetsPanel
                onAddElement={handleAddElement}
                onUploadMedia={handleUploadMedia}
                panelWidth={window.innerWidth}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            </div>
          )}

          {activeMobileTab === 'properties' && (
            <div className="flex flex-1 flex-col overflow-hidden bg-pp-dark">
              <div className="h-[28px] border-b border-black/30 bg-pp-medium flex items-center px-2 space-x-1 flex-shrink-0">
                <div
                  onClick={() => setActiveRightTab('properties')}
                  className={`pp-panel-tab ${activeRightTab === 'properties' ? 'active' : ''}`}
                >
                  Effect Controls
                </div>
                <div
                  onClick={() => setActiveRightTab('color')}
                  className={`pp-panel-tab ${activeRightTab === 'color' ? 'active' : ''}`}
                >
                  Lumetri Color
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {activeRightTab === 'properties' ? (
                  <PropertiesPanel
                    element={selectedElement}
                    onUpdate={handleUpdateElement}
                    onDelete={handleDeleteElement}
                    onSplitAudio={handleSplitAudio}
                    frameAspectRatio={previewAspectRatio}
                  />
                ) : (
                  <ColorPanel
                    element={selectedElement}
                    onUpdate={handleUpdateElement}
                  />
                )}
              </div>
            </div>
          )}

          {activeMobileTab === 'timeline' && (
            <div className="flex-1 w-full bg-pp-darkest relative z-40">
              <Timeline
                tracks={project.tracks}
                elements={project.elements}
                currentTime={project.currentTime}
                duration={project.duration}
                onSeek={handleSeek}
                onSelectElement={handleSelectElement}
                onToggleSelectElement={handleToggleSelectElement}
                selectedElementId={project.selectedElementId}
                selectedElementIds={project.selectedElementIds}
                onUpdateElement={handleUpdateElement}
                onSplit={handleSplit}
                pixelsPerSecond={pixelsPerSecond}
                setPixelsPerSecond={setPixelsPerSecond}
                onAddAsset={handleAddAssetToTrack}
                onInsertTrack={handleInsertTrack}
                onDeleteTrack={handleDeleteTrack}
                onUpdateTrack={(id, updates) => {
                  setProject(prev => ({
                    ...prev,
                    tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
                  }));
                }}
                rippleEditMode={rippleEditMode}
                onToggleRippleEdit={() => setRippleEditMode(!rippleEditMode)}
                snapEnabled={snapEnabled}
                onToggleSnap={() => setSnapEnabled(!snapEnabled)}
                onCloseGaps={handleCloseGaps}
                onCloseGap={handleCloseGap}
                markers={project.markers}
                onAddMarker={handleAddMarker}
                onUpdateMarker={handleUpdateMarker}
                onDeleteMarker={handleDeleteMarker}
                toolMode={toolMode}
                setToolMode={setToolMode}
                onSplitElement={handleSplitElement}
              />
            </div>
          )}
        </div>
      ) : (
        /* ========================= DESKTOP LAYOUT - PREMIERE PRO ========================= */
        <div className="flex flex-1 flex-col overflow-hidden bg-black p-[2px] gap-[3px]">
          {/* Upper workspace: Tools + Panels + Monitors */}
          <div ref={desktopWorkspaceRef} className="flex flex-1 flex-col overflow-hidden gap-[3px]">
            {/* Top Row: Source Monitor + Program Monitor */}
            <div className="flex overflow-hidden w-full gap-[2px]" style={{ flex: '1 1 55%', minHeight: 0 }}>
              {/* Top Left: Source Monitor Area (Effect Controls, Lumetri Color) */}
              <div
                className="flex-none flex flex-col overflow-hidden bg-pp-dark relative"
                style={{ width: `${topLeftPanelWidth}px` }}
              >
                {/* Panel tabs */}
                <div className="h-[28px] bg-pp-medium flex items-center px-2 space-x-1 flex-shrink-0 border-b border-black/30">
                  <div
                    onClick={() => setActiveRightTab('source')}
                    className={`pp-panel-tab ${activeRightTab === 'source' ? 'active' : ''}`}
                  >
                    Source: {sourceClip ? sourceClip.name : '(no clip)'}
                  </div>
                  <div
                    onClick={() => setActiveRightTab('properties')}
                    className={`pp-panel-tab ${activeRightTab === 'properties' ? 'active' : ''}`}
                  >
                    Effect Controls
                  </div>
                  <div
                    onClick={() => setActiveRightTab('color')}
                    className={`pp-panel-tab ${activeRightTab === 'color' ? 'active' : ''}`}
                  >
                    Lumetri Color
                  </div>
                </div>

                <div className={`flex-1 ${activeRightTab === 'source' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
                  {activeRightTab === 'source' ? (
                    <SourceMonitorPanel
                      clip={sourceClip}
                      onInsertToTimeline={(clip) => {
                        handleAddElement(clip.type, { src: clip.src, name: clip.name, assetId: clip.assetId });
                      }}
                    />
                  ) : activeRightTab === 'properties' ? (
                    <PropertiesPanel
                      element={selectedElement}
                      onUpdate={handleUpdateElement}
                      onDelete={handleDeleteElement}
                      onSplitAudio={handleSplitAudio}
                      frameAspectRatio={previewAspectRatio}
                    />
                  ) : (
                    <ColorPanel
                      element={selectedElement}
                      onUpdate={handleUpdateElement}
                    />
                  )}
                </div>

                {/* Left resize handle */}
                <div
                  className="absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize z-30 pp-resize-handle"
                  style={{ left: `${topLeftPanelWidth - 2}px` }}
                  onMouseDown={() => setIsResizingTopLeft(true)}
                />
              </div>

              {/* Top Right: Program Monitor */}
              <div className="min-w-0 flex-1 flex flex-col bg-pp-darkest relative">
                {/* Program Monitor tab */}
                <div className="h-[28px] bg-pp-medium flex items-center px-2 flex-shrink-0 border-b border-black/30">
                  <div className="pp-panel-tab active">Program Monitor</div>
                </div>
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
                    aspectRatio={previewAspectRatio}
                    onAspectRatioChange={applyPreviewAspectRatio}
                    onResetSelectedMediaToFrame={resetSelectedMediaToFrame}
                    duration={project.duration}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Row: Project + Tools + Timeline + Audio Meters */}
            <div className="flex overflow-hidden gap-[2px] flex-shrink-0" style={{ height: `${timelineHeight}px` }}>

              {/* Bottom Left: Project Bin / Effects */}
              <div
                className="flex-none flex flex-col bg-pp-dark min-h-0 relative"
                style={{ width: `${bottomLeftPanelWidth}px` }}
              >
                {/* Panel tabs */}
                <div className="h-[28px] bg-pp-medium flex items-center px-2 space-x-1 flex-shrink-0 border-b border-black/30 overflow-x-auto no-scrollbar">
                  <div
                    onClick={() => setActiveLeftBottomTab('project')}
                    className={`pp-panel-tab ${activeLeftBottomTab === 'project' ? 'active' : ''}`}
                  >
                    Project
                  </div>
                  <div
                    onClick={() => setActiveLeftBottomTab('effects')}
                    className={`pp-panel-tab ${activeLeftBottomTab === 'effects' ? 'active' : ''}`}
                  >
                    Effects
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {activeLeftBottomTab === 'project' ? (
                    <AssetsPanel
                      onAddElement={handleAddElement}
                      onUploadMedia={handleUploadMedia}
                      onPreviewClip={(clip) => {
                        setSourceClip(clip);
                        setActiveRightTab('source');
                      }}
                      panelWidth={bottomLeftPanelWidth}
                      onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                  ) : (
                    <EffectsPanel />
                  )}
                </div>

                {/* Left resize handle */}
                <div
                  className="absolute top-0 bottom-0 w-1 cursor-ew-resize z-30 pp-resize-handle"
                  style={{ right: `-2px` }}
                  onMouseDown={() => setIsResizingBottomLeft(true)}
                />
              </div>

              {/* Tools Panel */}
              <ToolsPanel
                activeTool={toolMode}
                onToolChange={(tool) => {
                  if (tool === 'blade') {
                    handleBladeAction();
                    return;
                  }
                  setToolMode(tool);
                }}
              />

              {/* Timeline resize handle */}
              <div
                className="absolute top-0 left-0 right-0 h-[5px] cursor-ns-resize z-50 pp-resize-handle group"
                onMouseDown={() => setIsResizingTimeline(true)}
              >
                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-16 h-[3px] rounded-full bg-pp-border group-hover:bg-pp-accent transition-colors" />
              </div>

              {/* Timeline */}
              <div className="flex-1 min-w-0">
                <Timeline
                  tracks={project.tracks}
                  elements={project.elements}
                  currentTime={project.currentTime}
                  duration={project.duration}
                  onSeek={handleSeek}
                  onSelectElement={handleSelectElement}
                  onToggleSelectElement={handleToggleSelectElement}
                  selectedElementId={project.selectedElementId}
                  selectedElementIds={project.selectedElementIds}
                  onUpdateElement={handleUpdateElement}
                  onSplit={handleSplit}
                  pixelsPerSecond={pixelsPerSecond}
                  setPixelsPerSecond={setPixelsPerSecond}
                  onAddAsset={handleAddAssetToTrack}
                  onInsertTrack={handleInsertTrack}
                  onDeleteTrack={handleDeleteTrack}
                  onUpdateTrack={(id, updates) => {
                    setProject(prev => ({
                      ...prev,
                      tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
                    }));
                  }}
                  rippleEditMode={rippleEditMode}
                  onToggleRippleEdit={() => setRippleEditMode(!rippleEditMode)}
                  snapEnabled={snapEnabled}
                  onToggleSnap={() => setSnapEnabled(!snapEnabled)}
                  onCloseGaps={handleCloseGaps}
                  onCloseGap={handleCloseGap}
                  markers={project.markers}
                  onAddMarker={handleAddMarker}
                  onUpdateMarker={handleUpdateMarker}
                  onDeleteMarker={handleDeleteMarker}
                  toolMode={toolMode}
                  setToolMode={setToolMode}
                  onSplitElement={handleSplitElement}
                />
              </div>

              {/* Audio Meters */}
              <div className="flex-none flex flex-col bg-pp-dark min-h-0 relative w-[80px]">
                <AudioMixerPanel
                  tracks={project.tracks}
                  elements={project.elements}
                  currentTime={project.currentTime}
                  isPlaying={project.isPlaying}
                  onUpdateTrack={(id, updates) => {
                    setProject(prev => ({
                      ...prev,
                      tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
                    }));
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

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
        aspectRatio={previewAspectRatio}
        formats={supportedExportFormats}
        presets={exportPresets}
        isExporting={project.isExporting}
      />
    </div>
  );
};

export default App;
