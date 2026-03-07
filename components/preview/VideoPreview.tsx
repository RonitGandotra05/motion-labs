import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { EditorElement, ElementType } from '../../types';
import { PlayIcon, PauseIcon } from '../ui/Icons';

interface VideoPreviewProps {
  currentTime: number;
  isPlaying: boolean;
  elements: EditorElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<EditorElement>) => void;
  onTimeUpdate: (time: number) => void;
  togglePlay: () => void;
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
}

export interface VideoPreviewHandle {
  captureStream: (fps: number) => MediaStream;
}

const VideoPreview = forwardRef<VideoPreviewHandle, VideoPreviewProps>(({
  currentTime,
  isPlaying,
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onTimeUpdate,
  togglePlay,
  aspectRatio,
  onAspectRatioChange
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const aspectRatioPresets = [
    { value: '16:9', label: 'YouTube Thumbnail', detail: 'Thumbnail / landscape' },
    { value: '9:16', label: 'Shorts', detail: 'Vertical video' },
    { value: '4:5', label: 'Instagram Portrait', detail: 'Feed portrait' },
    { value: '1:1', label: 'Square', detail: 'Post / album' },
    { value: '4:3', label: 'Classic Landscape', detail: 'Presentation' },
    { value: '3:4', label: 'Classic Portrait', detail: 'Poster layout' },
    { value: '9:4', label: 'Banner', detail: 'Wide strip' }
  ];
  const activeAspectRatioPreset = aspectRatioPresets.find(preset => preset.value === aspectRatio);
  const parsedAspectRatio = (() => {
    const [width, height] = aspectRatio.split(':').map(Number);
    if (!width || !height) return 16 / 9;
    return width / height;
  })();
  const selectedMediaElement = elements.find(
    element =>
      element.id === selectedElementId &&
      (element.type === ElementType.VIDEO || element.type === ElementType.IMAGE)
  );
  const selectedMediaZoom = selectedMediaElement?.props.mediaZoom ?? 1;
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [showCenterGuide, setShowCenterGuide] = useState(false);
  const [monitorZoom, setMonitorZoom] = useState<'fit' | 50 | 100 | 200>('fit');

  const getMediaObjectFit = (fitMode?: EditorElement['props']['mediaFitMode']) => {
    switch (fitMode) {
      case 'fill':
        return 'cover';
      case 'stretch':
        return 'fill';
      default:
        return 'contain';
    }
  };

  const getMonitorScale = () => {
    switch (monitorZoom) {
      case 50:
        return 0.5;
      case 100:
        return 1;
      case 200:
        return 2;
      default:
        return 0.8;
    }
  };

  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resizing State
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [initialElementState, setInitialElementState] = useState<{ x: number, y: number, w: number, h: number, r: number } | null>(null);
  const [startMousePos, setStartMousePos] = useState({ x: 0, y: 0 });

  // Audio Context Ref
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>>(new WeakMap());
  const audioNodesRef = useRef<Map<string, { hp: BiquadFilterNode; lp: BiquadFilterNode; gain: GainNode }>>(new Map());

  useImperativeHandle(ref, () => ({
    captureStream: (fps: number) => {
      if (containerRef.current) {
        const videoEl = document.querySelector('video') as HTMLVideoElement;
        if (videoEl && (videoEl as any).captureStream) {
          return (videoEl as any).captureStream(fps);
        }
      }
      throw new Error("Export unavailable in this environment");
    }
  }));

  // -- Audio / Video Sync & Effects Logic --
  useEffect(() => {
    // Initialize Audio Context on user interaction (or first run if allowed)
    if (!audioContextRef.current) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }

    const ctx = audioContextRef.current;

    // Resume context if suspended (browser policy)
    if (ctx && ctx.state === 'suspended' && isPlaying) {
      ctx.resume().catch(e => console.error("Audio resume failed", e));
    }

    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach((el: any) => {
      const id = el.dataset.elementId;
      const element = elements.find(e => e.id === id);

      if (element) {
        // Time Sync
        if (currentTime >= element.startTime && currentTime <= element.startTime + element.duration) {
          const targetTime = (currentTime - element.startTime) + element.mediaOffset;
          if (Math.abs(el.currentTime - targetTime) > 0.3) {
            el.currentTime = targetTime;
          }
          if (isPlaying && el.paused) {
            el.play().catch(() => { });
          } else if (!isPlaying && !el.paused) {
            el.pause();
          }

          // Audio Effects Setup (Web Audio API)
          if (ctx) {
            // Create source if not exists
            let source = audioSourcesRef.current.get(el);
            if (!source) {
              try {
                // Determine if we can create source (might need crossOrigin set on element for remote)
                // el.crossOrigin = "anonymous"; 
                source = ctx.createMediaElementSource(el);
                audioSourcesRef.current.set(el, source);

                // Create processing nodes
                const hp = ctx.createBiquadFilter();
                hp.type = 'highpass';

                const lp = ctx.createBiquadFilter();
                lp.type = 'lowpass';

                const gain = ctx.createGain();

                // Chain: Source -> HP -> LP -> Gain -> Destination
                source.connect(hp);
                hp.connect(lp);
                lp.connect(gain);
                gain.connect(ctx.destination);

                audioNodesRef.current.set(id!, { hp, lp, gain });
              } catch (err) {
                console.warn("Could not create media source for EQ:", err);
              }
            }

            // Update Nodes if they exist
            const nodes = audioNodesRef.current.get(id!);
            if (nodes) {
              // Update EQ
              const hpFreq = element.props.highPassFrequency || 0;
              const lpFreq = element.props.lowPassFrequency || 20000;

              if (nodes.hp.frequency.value !== hpFreq) nodes.hp.frequency.value = hpFreq;
              if (nodes.lp.frequency.value !== lpFreq) nodes.lp.frequency.value = lpFreq;

              // Calculate Volume with Ducking
              let effectiveVolume = element.props.volume ?? 1;
              if (element.props.isMuted) effectiveVolume = 0;

              // Ducking Logic
              const activeDuckingSource = elements.find(e =>
                e.id !== element.id &&
                (e.type === ElementType.VIDEO || e.type === ElementType.AUDIO) &&
                e.props.ducking &&
                currentTime >= e.startTime &&
                currentTime <= e.startTime + e.duration
              );

              if (activeDuckingSource) {
                effectiveVolume *= (activeDuckingSource.props.duckingThreshold ?? 0.2);
              }

              // Apply to Gain Node
              // We use a small ramp to prevent clicks
              // nodes.gain.gain.setTargetAtTime(effectiveVolume, ctx.currentTime, 0.05); 
              // Simple assignment is often fine for UI sliders, but setTargetAtTime is better
              nodes.gain.gain.value = effectiveVolume;
            }
          } else {
            // Fallback if Web Audio not supported (Basic Volume/Mute)
            let effectiveVolume = element.props.volume ?? 1;
            // ... duplicate ducking logic for fallback ...
            const activeDuckingSource = elements.find(e =>
              e.id !== element.id &&
              (e.type === ElementType.VIDEO || e.type === ElementType.AUDIO) &&
              e.props.ducking &&
              currentTime >= e.startTime &&
              currentTime <= e.startTime + e.duration
            );
            if (activeDuckingSource) effectiveVolume *= (activeDuckingSource.props.duckingThreshold ?? 0.2);

            el.volume = effectiveVolume;
            el.muted = element.props.isMuted ?? false;
          }

          // Speed always on element
          el.playbackRate = element.props.playbackRate ?? 1;

        } else {
          if (!el.paused) el.pause();
        }
      }
    });
  }, [currentTime, isPlaying, elements]);


  const handleElementMouseDown = (e: React.MouseEvent | React.TouchEvent, element: EditorElement) => {
    e.stopPropagation();
    // Do not prevent default unconditionally, otherwise inputs might fail, but okay for canvas drag
    onSelectElement(element.id);
    setIsDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    setDragOffset({
      x: clientX,
      y: clientY
    });
    setInitialElementState({
      x: element.x,
      y: element.y,
      w: element.width,
      h: element.height,
      r: element.rotation
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent | React.TouchEvent, handle: string, element: EditorElement) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeHandle(handle);

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    setStartMousePos({ x: clientX, y: clientY });
    setInitialElementState({
      x: element.x,
      y: element.y,
      w: element.width,
      h: element.height,
      r: element.rotation
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current || !selectedElementId || !initialElementState) return;
      const rect = containerRef.current.getBoundingClientRect();

      const isTouch = 'touches' in e;
      if (isTouch && (isDragging || isResizing)) {
        if (e.cancelable) e.preventDefault(); // Prevent scrolling while dragging
      }

      const clientX = isTouch ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = isTouch ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      if (isDragging) {
        // Drag Logic
        const deltaX = clientX - dragOffset.x;
        const deltaY = clientY - dragOffset.y;

        const deltaXPercent = (deltaX / rect.width) * 100;
        const deltaYPercent = (deltaY / rect.height) * 100;

        onUpdateElement(selectedElementId, {
          x: initialElementState.x + deltaXPercent,
          y: initialElementState.y + deltaYPercent
        });

      } else if (isResizing && resizeHandle) {
        // Resize Logic with Rotation Support
        const deltaX = clientX - startMousePos.x;
        const deltaY = clientY - startMousePos.y;

        // Convert screen delta to local delta (rotated)
        const rad = (initialElementState.r * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Project screen delta onto element axes
        const localDeltaX = (deltaX * cos) + (deltaY * sin);
        const localDeltaY = (deltaY * cos) - (deltaX * sin);

        // Convert to percentage
        const ldXPercent = (localDeltaX / rect.width) * 100;
        const ldYPercent = (localDeltaY / rect.height) * 100;

        let newX = initialElementState.x;
        let newY = initialElementState.y;
        let newW = initialElementState.w;
        let newH = initialElementState.h;

        // Apply resizing
        const applyXChange = (amount: number, isLeft: boolean) => {
          if (isLeft) {
            const half = amount / 2;
            const dx = -(half * rect.width / 100) * cos;
            const dy = -(half * rect.width / 100) * sin;
            newX += (dx / rect.width) * 100;
            newY += (dy / rect.height) * 100;
            newW -= amount;
          } else {
            const half = amount / 2;
            const dx = (half * rect.width / 100) * cos;
            const dy = (half * rect.width / 100) * sin;
            newX += (dx / rect.width) * 100;
            newY += (dy / rect.height) * 100;
            newW += amount;
          }
        };

        const applyYChange = (amount: number, isTop: boolean) => {
          if (isTop) {
            const half = amount / 2;
            const dx = (half * rect.height / 100) * sin;
            const dy = -(half * rect.height / 100) * cos;
            newX += (dx / rect.width) * 100;
            newY += (dy / rect.height) * 100;
            newH -= amount;
          } else {
            const half = amount / 2;
            const dx = -(half * rect.height / 100) * sin;
            const dy = (half * rect.height / 100) * cos;
            newX += (dx / rect.width) * 100;
            newY += (dy / rect.height) * 100;
            newH += amount;
          }
        };

        if (resizeHandle.includes('e')) applyXChange(ldXPercent, false);
        if (resizeHandle.includes('w')) applyXChange(ldXPercent, true);
        if (resizeHandle.includes('s')) applyYChange(ldYPercent, false);
        if (resizeHandle.includes('n')) applyYChange(ldYPercent, true);

        const nextWidth = Math.max(1, newW);
        const nextHeight = Math.max(1, newH);
        const shouldLockAspectRatio = elements.find(element => element.id === selectedElementId)?.lockAspectRatio;

        if (shouldLockAspectRatio) {
          const selectedElement = elements.find(element => element.id === selectedElementId);
          const lockedAspectRatio =
            selectedElement?.props.sourceAspectRatio ||
            (initialElementState.w > 0 && initialElementState.h > 0 ? initialElementState.w / initialElementState.h : 1);

          let adjustedWidth = nextWidth;
          let adjustedHeight = nextHeight;

          if (resizeHandle === 'n' || resizeHandle === 's') {
            adjustedWidth = adjustedHeight * lockedAspectRatio;
          } else {
            adjustedHeight = adjustedWidth / lockedAspectRatio;
          }

          onUpdateElement(selectedElementId, {
            x: newX,
            y: newY,
            width: Math.max(1, adjustedWidth),
            height: Math.max(1, adjustedHeight)
          });
          return;
        }

        onUpdateElement(selectedElementId, {
          x: newX,
          y: newY,
          width: nextWidth,
          height: nextHeight
        });
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
      setInitialElementState(null);
    };

    if (isDragging || isResizing) {
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
  }, [isDragging, isResizing, selectedElementId, dragOffset, startMousePos, initialElementState]);


  const renderVisualElement = (el: EditorElement) => {
    if (currentTime < el.startTime || currentTime > el.startTime + el.duration) return null;
    if (el.type === ElementType.AUDIO) return null;

    const isSelected = selectedElementId === el.id;

    // Calculate transition effects
    const elapsedTime = currentTime - el.startTime;
    const remainingTime = (el.startTime + el.duration) - currentTime;
    let transitionOpacity = 1;
    let transitionTransform = '';

    // Transition In
    if (el.transitionIn && el.transitionIn.type !== 'none' && elapsedTime < el.transitionIn.duration) {
      const progress = elapsedTime / el.transitionIn.duration;
      switch (el.transitionIn.type) {
        case 'fade':
        case 'dissolve':
          transitionOpacity = progress;
          break;
        case 'zoom-in':
          transitionOpacity = progress;
          transitionTransform = `scale(${0.5 + 0.5 * progress})`;
          break;
        case 'zoom-out':
          transitionOpacity = progress;
          transitionTransform = `scale(${1.5 - 0.5 * progress})`;
          break;
        case 'wipe-left':
          transitionTransform = `translateX(${(1 - progress) * 100}%)`;
          break;
        case 'wipe-right':
          transitionTransform = `translateX(${(progress - 1) * 100}%)`;
          break;
        case 'wipe-up':
          transitionTransform = `translateY(${(1 - progress) * 100}%)`;
          break;
        case 'wipe-down':
          transitionTransform = `translateY(${(progress - 1) * 100}%)`;
          break;
      }
    }

    // Transition Out
    if (el.transitionOut && el.transitionOut.type !== 'none' && remainingTime < el.transitionOut.duration) {
      const progress = remainingTime / el.transitionOut.duration;
      switch (el.transitionOut.type) {
        case 'fade':
        case 'dissolve':
          transitionOpacity = Math.min(transitionOpacity, progress);
          break;
        case 'zoom-in':
          transitionOpacity = Math.min(transitionOpacity, progress);
          transitionTransform = `scale(${1.5 - 0.5 * progress})`;
          break;
        case 'zoom-out':
          transitionOpacity = Math.min(transitionOpacity, progress);
          transitionTransform = `scale(${0.5 + 0.5 * progress})`;
          break;
        case 'wipe-left':
          transitionTransform = `translateX(${(progress - 1) * 100}%)`;
          break;
        case 'wipe-right':
          transitionTransform = `translateX(${(1 - progress) * 100}%)`;
          break;
        case 'wipe-up':
          transitionTransform = `translateY(${(progress - 1) * 100}%)`;
          break;
        case 'wipe-down':
          transitionTransform = `translateY(${(1 - progress) * 100}%)`;
          break;
      }
    }

    // Text Animation Logic
    let textContent = el.props.text;
    let textAnimOpacity = 1;
    let textAnimTransform = '';
    let textAnimBlur = 0;

    if (el.type === ElementType.TEXT && el.props.textAnimation && el.props.textAnimation !== 'none') {
      const animDuration = el.props.animationDuration || 1;
      if (elapsedTime < animDuration) {
        const p = elapsedTime / animDuration;
        const easeOut = 1 - Math.pow(1 - p, 3); // Cubic ease out

        switch (el.props.textAnimation) {
          case 'typewriter':
            if (textContent) {
              const len = Math.floor(textContent.length * p);
              textContent = textContent.slice(0, len);
            }
            break;
          case 'slide-up':
            textAnimTransform = `translateY(${(1 - easeOut) * 50}px)`; // Slide up 50px
            textAnimOpacity = easeOut;
            break;
          case 'fade-in':
            textAnimOpacity = p;
            break;
          case 'scale-up':
            textAnimTransform = `scale(${easeOut})`;
            textAnimOpacity = p;
            break;
          case 'blur-in':
            textAnimBlur = (1 - p) * 20;
            textAnimOpacity = p;
            break;
        }
      }
    }

    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      width: `${el.width}%`,
      height: `${el.height}%`,
      transform: [
        `rotate(${el.rotation}deg)`,
        transitionTransform,
        el.flipX ? 'scaleX(-1)' : '',
        el.flipY ? 'scaleY(-1)' : ''
      ].filter(Boolean).join(' '),
      cursor: isSelected ? 'move' : 'default',
      zIndex: 10 + (el.zIndex ?? 0),
      border: isSelected ? '2px solid #3b82f6' : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      opacity: transitionOpacity,
    };

    const contentStyle: React.CSSProperties = {
      backgroundColor: el.props.backgroundColor,
      color: el.props.color || 'white',
      borderRadius: el.props.borderRadius ? `${el.props.borderRadius}px` : '0',
      fontSize: el.props.fontSize ? `${el.props.fontSize}px` : '16px',
      opacity: (el.props.opacity ?? 1) * textAnimOpacity,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: el.type === ElementType.TEXT ? 'flex-start' : 'center',
      justifyContent: el.props.textAlign || 'center',
      overflow: 'hidden',
      border: el.props.borderWidth ? `${el.props.borderWidth}px solid ${el.props.borderColor || 'black'}` : 'none',
      pointerEvents: 'none',
      // Text styling
      fontFamily: el.props.fontFamily || 'Inter, sans-serif',
      fontWeight: el.props.fontWeight || 400,
      textAlign: el.props.textAlign || 'center',
      letterSpacing: el.props.letterSpacing ? `${el.props.letterSpacing}px` : undefined,
      lineHeight: el.props.lineHeight || 1.2,
      // Text Animation Transform
      transform: textAnimTransform,
      // Text shadow
      textShadow: el.props.textShadowColor ?
        `${el.props.textShadowX ?? 2}px ${el.props.textShadowY ?? 2}px ${el.props.textShadowBlur ?? 0}px ${el.props.textShadowColor}` : undefined,
      // Drop shadow (box-shadow)
      boxShadow: el.props.shadowColor ?
        `${el.props.shadowX ?? 4}px ${el.props.shadowY ?? 4}px ${el.props.shadowBlur ?? 10}px ${el.props.shadowColor}` : undefined,
      // DaVinci-style CSS Filters + Text Animation Blur
      filter: [
        (el.type === ElementType.VIDEO || el.type === ElementType.IMAGE) && el.props.blur ? `blur(${el.props.blur}px)` : '',
        textAnimBlur > 0 ? `blur(${textAnimBlur}px)` : '',
        (el.type === ElementType.VIDEO || el.type === ElementType.IMAGE) && el.props.brightness !== undefined && el.props.brightness !== 1 ? `brightness(${el.props.brightness})` : '',
        (el.type === ElementType.VIDEO || el.type === ElementType.IMAGE) && el.props.contrast !== undefined && el.props.contrast !== 1 ? `contrast(${el.props.contrast})` : '',
        (el.type === ElementType.VIDEO || el.type === ElementType.IMAGE) && el.props.saturation !== undefined && el.props.saturation !== 1 ? `saturate(${el.props.saturation})` : '',
        (el.type === ElementType.VIDEO || el.type === ElementType.IMAGE) && el.props.grayscale ? `grayscale(${el.props.grayscale})` : '',
        (el.type === ElementType.VIDEO || el.type === ElementType.IMAGE) && el.props.sepia ? `sepia(${el.props.sepia})` : '',
        (el.type === ElementType.VIDEO || el.type === ElementType.IMAGE) && el.props.hueRotate ? `hue-rotate(${el.props.hueRotate}deg)` : '',
      ].filter(Boolean).join(' ') || undefined,
      // Blend Mode
      mixBlendMode: el.props.blendMode as React.CSSProperties['mixBlendMode'] || undefined,
    };

    const mediaViewportStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      borderRadius: contentStyle.borderRadius,
      opacity: contentStyle.opacity,
      filter: contentStyle.filter,
      mixBlendMode: contentStyle.mixBlendMode,
      clipPath: `inset(${el.props.cropTop ?? 0}% ${el.props.cropRight ?? 0}% ${el.props.cropBottom ?? 0}% ${el.props.cropLeft ?? 0}%)`
    };

    const mediaStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: getMediaObjectFit(el.props.mediaFitMode),
      transform: `scale(${el.props.mediaZoom ?? 1})`,
      transformOrigin: 'center center',
      pointerEvents: 'none'
    };

    // AI Generated Custom HTML
    // We scope CSS by replacing .root with a unique ID class
    const scopedCss = el.type === ElementType.AI_GENERATED && el.props.customCss
      ? el.props.customCss.replace(/\.root/g, `.gen-${el.id}`)
      : '';

    // Render Resize Handles
    const renderHandles = () => {
      if (!isSelected) return null;
      const hStyle = "absolute w-3 h-3 bg-white border border-blue-500 rounded-full z-20 pointer-events-auto hover:bg-blue-100 hover:scale-125 transition-transform";
      return (
        <>
          <div className={`${hStyle} -top-1.5 -left-1.5 cursor-nw-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'nw', el)} onTouchStart={(e) => handleResizeMouseDown(e, 'nw', el)} />
          <div className={`${hStyle} -top-1.5 left-1/2 -translate-x-1/2 cursor-n-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'n', el)} onTouchStart={(e) => handleResizeMouseDown(e, 'n', el)} />
          <div className={`${hStyle} -top-1.5 -right-1.5 cursor-ne-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'ne', el)} onTouchStart={(e) => handleResizeMouseDown(e, 'ne', el)} />
          <div className={`${hStyle} top-1/2 -translate-y-1/2 -right-1.5 cursor-e-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'e', el)} onTouchStart={(e) => handleResizeMouseDown(e, 'e', el)} />
          <div className={`${hStyle} -bottom-1.5 -right-1.5 cursor-se-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'se', el)} onTouchStart={(e) => handleResizeMouseDown(e, 'se', el)} />
          <div className={`${hStyle} -bottom-1.5 left-1/2 -translate-x-1/2 cursor-s-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 's', el)} onTouchStart={(e) => handleResizeMouseDown(e, 's', el)} />
          <div className={`${hStyle} -bottom-1.5 -left-1.5 cursor-sw-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'sw', el)} onTouchStart={(e) => handleResizeMouseDown(e, 'sw', el)} />
          <div className={`${hStyle} top-1/2 -translate-y-1/2 -left-1.5 cursor-w-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'w', el)} onTouchStart={(e) => handleResizeMouseDown(e, 'w', el)} />
        </>
      );
    }

    return (
      <div key={el.id} style={style} onMouseDown={(e) => handleElementMouseDown(e, el)} onTouchStart={(e) => handleElementMouseDown(e, el)}>

        {el.type === ElementType.VIDEO && el.props.src && (
          <div style={mediaViewportStyle}>
            <video
              data-element-id={el.id}
              src={el.props.src}
              className="w-full h-full"
              style={mediaStyle}
            />
          </div>
        )}

        {el.type === ElementType.IMAGE && el.props.src && (
          <div style={mediaViewportStyle}>
            <img
              src={el.props.src}
              className="w-full h-full"
              style={mediaStyle}
            />
          </div>
        )}

        {(el.type === ElementType.TEXT || el.type === ElementType.SHAPE) && (
          <div style={contentStyle} className="p-2 whitespace-pre-wrap text-center">
            {textContent}
          </div>
        )}

        {/* Custom AI Component Rendering */}
        {el.type === ElementType.AI_GENERATED && (
          <div className={`w-full h-full gen-${el.id} relative pointer-events-none`}>
            {scopedCss && <style>{scopedCss}</style>}
            {/* Dangerously Set HTML - in production would need sanitization */}
            {el.props.html ? (
              <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: el.props.html }} />
            ) : (
              <div style={contentStyle} className="p-2 text-center text-xs">AI Generating...</div>
            )}
          </div>
        )}

        {renderHandles()}
      </div>
    );
  };

  const renderMonitorGuides = () => {
    if (!showSafeMargins && !showCenterGuide) return null;

    return (
      <div className="pointer-events-none absolute inset-0 z-40">
        {showSafeMargins && (
          <>
            <div
              className="absolute border border-amber-400/90"
              style={{
                left: '10%',
                top: '10%',
                width: '80%',
                height: '80%'
              }}
            />
            <div
              className="absolute border border-cyan-400/90"
              style={{
                left: '20%',
                top: '20%',
                width: '60%',
                height: '60%'
              }}
            />
            <div className="absolute left-3 bottom-3 rounded bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
              Safe margins
            </div>
          </>
        )}
        {showCenterGuide && (
          <>
            <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-fuchsia-400/80" />
            <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-fuchsia-400/80" />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-pp-darkest transition-colors h-full w-full" style={{ zIndex: 1 }}>
      {/* Video preview area */}
      <div
        className="flex flex-1 w-full items-center justify-center overflow-hidden p-4 min-h-0"
      >
        <div
          ref={containerRef}
          className="relative bg-black overflow-hidden"
          style={{
            width: '80%',
            aspectRatio: `${parsedAspectRatio}`,
            maxHeight: '100%',
            maxWidth: '100%',
            transform: `scale(${getMonitorScale()})`,
            transformOrigin: 'center center'
          }}
          onClick={() => onSelectElement(null)}
        >
          {renderMonitorGuides()}

          {elements.filter(e => e.type === ElementType.AUDIO && e.props.src).map(el => (
            <audio key={el.id} data-element-id={el.id} src={el.props.src} />
          ))}

          {/* Sort by zIndex for proper layering */}
          {[...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map(renderVisualElement)}
        </div>
      </div>

      {/* Premiere Pro Program Monitor Toolbar - pinned at bottom */}
      <div className="flex-shrink-0 h-[36px] bg-pp-dark w-full border-t border-black/30 flex items-center px-4 relative z-20">
        {/* Left: Timecode and Fit */}
        <div className="flex items-center space-x-4 flex-shrink-0">
          <span className="pp-timecode text-pp-timecode text-[12px] font-mono">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}:00:00
          </span>

          <select
            value={aspectRatio}
            onChange={(e) => onAspectRatioChange(e.target.value)}
            className="bg-transparent border border-transparent hover:border-pp-border rounded px-1 py-0.5 text-[11px] text-pp-text-dim hover:text-pp-text outline-none cursor-pointer hidden md:block"
            data-tip="Sequence Settings"
          >
            {aspectRatioPresets.map(preset => (
              <option key={preset.value} value={preset.value} className="bg-pp-menu-bg text-pp-text">{preset.label} ({preset.value})</option>
            ))}
          </select>

          <select
            value={monitorZoom}
            onChange={(e) => setMonitorZoom(e.target.value as any)}
            className="bg-pp-dark border border-pp-border rounded px-2 py-0.5 text-[11px] text-pp-text outline-none cursor-pointer"
          >
            <option value="fit" className="bg-pp-menu-bg">Fit</option>
            <option value="50" className="bg-pp-menu-bg">50%</option>
            <option value="100" className="bg-pp-menu-bg">100%</option>
            <option value="200" className="bg-pp-menu-bg">200%</option>
          </select>
        </div>

        {/* Center: Transport Controls */}
        <div className="flex items-center space-x-1 flex-1 justify-center">
          <button className="pp-transport-btn" data-tip="Go to In"><span className="text-[10px]">⏮</span></button>
          <button className="pp-transport-btn" onClick={() => onTimeUpdate(Math.max(0, currentTime - 0.1))} data-tip="Step Back 1 Frame"><span className="text-[10px]">◀</span></button>
          <button
            onClick={togglePlay}
            className="pp-transport-btn w-8 h-8 mx-1"
            data-tip={isPlaying ? "Stop" : "Play"}
          >
            {isPlaying ? <span className="text-[12px]">⏸</span> : <span className="text-[14px]">▶</span>}
          </button>
          <button className="pp-transport-btn" onClick={() => onTimeUpdate(Math.min(9999, currentTime + 0.1))} data-tip="Step Forward 1 Frame"><span className="text-[10px]">▶</span></button>
          <button className="pp-transport-btn" data-tip="Go to Out"><span className="text-[10px]">⏭</span></button>
        </div>

        {/* Right: Tools & Overlays */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => setShowSafeMargins(prev => !prev)}
            className={`pp-icon-btn w-6 h-6 border ${showSafeMargins ? 'border-pp-accent text-pp-accent bg-pp-light' : 'border-transparent text-pp-text-dim'}`}
            data-tip="Safe Margins"
          >
            <span className="text-[10px]">☐</span>
          </button>
          <button
            onClick={() => { }}
            className="pp-icon-btn w-6 h-6 border border-transparent text-pp-text-dim"
            data-tip="Button Editor"
          >
            <span className="text-[12px] font-bold">+</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default VideoPreview;
