
export enum ElementType {
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  TEXT = 'TEXT',
  SHAPE = 'SHAPE',
  IMAGE = 'IMAGE',
  AI_GENERATED = 'AI_GENERATED'
}

// Transition types for clips
export type TransitionType = 'none' | 'fade' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'zoom-in' | 'zoom-out';

export interface Transition {
  type: TransitionType;
  duration: number; // seconds
}

// Timeline markers
export interface Marker {
  id: string;
  time: number; // seconds
  name: string;
  color: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';
  note?: string;
}

export interface ElementProps {
  text?: string;
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  borderRadius?: number;
  opacity?: number; // 0-1, default 1
  src?: string; // For images/videos/audio
  borderColor?: string;
  borderWidth?: number;
  volume?: number; // 0-1
  isMuted?: boolean;

  // Text styling
  fontFamily?: string;
  fontWeight?: 300 | 400 | 500 | 600 | 700 | 800;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number; // pixels
  lineHeight?: number; // multiplier

  // Text shadow
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowX?: number;
  textShadowY?: number;

  // Drop shadow (all visual elements)
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;

  // New properties for Custom AI Components
  html?: string;
  customCss?: string;

  // DaVinci-style properties
  playbackRate?: number; // 0.25 to 4, default 1
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

  // Video Filters
  blur?: number; // pixels
  brightness?: number; // 0-2, default 1
  contrast?: number; // 0-2, default 1
  saturation?: number; // 0-2, default 1
  grayscale?: number; // 0-1
  sepia?: number; // 0-1
  hueRotate?: number; // degrees 0-360
}

export interface EditorElement {
  id: string;
  type: ElementType;
  trackId: number;
  name: string;
  startTime: number; // in seconds (Timeline position)
  duration: number; // in seconds
  mediaOffset: number; // in seconds (Start point in the source media)

  // Visual properties for overlay
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage
  height: number; // percentage
  rotation: number;
  zIndex: number; // Layer stacking order
  flipX?: boolean; // Flip horizontally
  flipY?: boolean; // Flip vertically

  // Transitions
  transitionIn?: Transition;
  transitionOut?: Transition;

  props: ElementProps;

  // For persisting media elements across page refreshes
  assetId?: string;
}

export interface Track {
  id: number;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
  type: 'video' | 'audio' | 'overlay';
}

export interface ProjectState {
  currentTime: number;
  duration: number; // Total project duration
  isPlaying: boolean;
  zoomLevel: number; // pixels per second
  elements: EditorElement[];
  tracks: Track[];
  markers: Marker[]; // Timeline markers
  selectedElementId: string | null;
  videoSrc: string | null; // Deprecated in favor of elements, but kept for compatibility if needed, though we will move to track-based video
  isExporting: boolean;
}

// AI Service Types
export interface GeneratedComponentConfig {
  type: ElementType;
  props: ElementProps;
  name: string;
}

