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
  togglePlay
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);

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
  const audioSourcesRef = useRef<WeakMap<HTMLMediaElement, MediaElementSourceNode>>(new WeakMap());
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


  const handleElementMouseDown = (e: React.MouseEvent, element: EditorElement) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent default text selection
    onSelectElement(element.id);
    setIsDragging(true);
    setDragOffset({
      x: e.clientX,
      y: e.clientY
    });
    setInitialElementState({
      x: element.x,
      y: element.y,
      w: element.width,
      h: element.height,
      r: element.rotation
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string, element: EditorElement) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeHandle(handle);
    setStartMousePos({ x: e.clientX, y: e.clientY });
    setInitialElementState({
      x: element.x,
      y: element.y,
      w: element.width,
      h: element.height,
      r: element.rotation
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !selectedElementId || !initialElementState) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isDragging) {
        // Drag Logic
        const deltaX = e.clientX - dragOffset.x;
        const deltaY = e.clientY - dragOffset.y;

        const deltaXPercent = (deltaX / rect.width) * 100;
        const deltaYPercent = (deltaY / rect.height) * 100;

        onUpdateElement(selectedElementId, {
          x: initialElementState.x + deltaXPercent,
          y: initialElementState.y + deltaYPercent
        });

      } else if (isResizing && resizeHandle) {
        // Resize Logic with Rotation Support
        const deltaX = e.clientX - startMousePos.x;
        const deltaY = e.clientY - startMousePos.y;

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

        onUpdateElement(selectedElementId, {
          x: newX,
          y: newY,
          width: Math.max(1, newW),
          height: Math.max(1, newH)
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
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
      opacity: el.props.opacity ?? 1,
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
      // Text shadow
      textShadow: el.props.textShadowColor ?
        `${el.props.textShadowX ?? 2}px ${el.props.textShadowY ?? 2}px ${el.props.textShadowBlur ?? 0}px ${el.props.textShadowColor}` : undefined,
      // Drop shadow (box-shadow)
      boxShadow: el.props.shadowColor ?
        `${el.props.shadowX ?? 4}px ${el.props.shadowY ?? 4}px ${el.props.shadowBlur ?? 10}px ${el.props.shadowColor}` : undefined,
      // DaVinci-style CSS Filters
      filter: (el.type === ElementType.VIDEO || el.type === ElementType.IMAGE) ? [
        el.props.blur ? `blur(${el.props.blur}px)` : '',
        el.props.brightness !== undefined && el.props.brightness !== 1 ? `brightness(${el.props.brightness})` : '',
        el.props.contrast !== undefined && el.props.contrast !== 1 ? `contrast(${el.props.contrast})` : '',
        el.props.saturation !== undefined && el.props.saturation !== 1 ? `saturate(${el.props.saturation})` : '',
        el.props.grayscale ? `grayscale(${el.props.grayscale})` : '',
        el.props.sepia ? `sepia(${el.props.sepia})` : '',
        el.props.hueRotate ? `hue-rotate(${el.props.hueRotate}deg)` : '',
      ].filter(Boolean).join(' ') || undefined : undefined,
      // Blend Mode
      mixBlendMode: el.props.blendMode as React.CSSProperties['mixBlendMode'] || undefined,
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
          <div className={`${hStyle} -top-1.5 -left-1.5 cursor-nw-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'nw', el)} />
          <div className={`${hStyle} -top-1.5 left-1/2 -translate-x-1/2 cursor-n-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'n', el)} />
          <div className={`${hStyle} -top-1.5 -right-1.5 cursor-ne-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'ne', el)} />
          <div className={`${hStyle} top-1/2 -translate-y-1/2 -right-1.5 cursor-e-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'e', el)} />
          <div className={`${hStyle} -bottom-1.5 -right-1.5 cursor-se-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'se', el)} />
          <div className={`${hStyle} -bottom-1.5 left-1/2 -translate-x-1/2 cursor-s-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 's', el)} />
          <div className={`${hStyle} -bottom-1.5 -left-1.5 cursor-sw-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'sw', el)} />
          <div className={`${hStyle} top-1/2 -translate-y-1/2 -left-1.5 cursor-w-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'w', el)} />
        </>
      );
    }

    return (
      <div key={el.id} style={style} onMouseDown={(e) => handleElementMouseDown(e, el)}>

        {el.type === ElementType.VIDEO && el.props.src && (
          <video
            data-element-id={el.id}
            src={el.props.src}
            className="w-full h-full object-cover pointer-events-none"
            style={{ borderRadius: contentStyle.borderRadius }}
          />
        )}

        {el.type === ElementType.IMAGE && el.props.src && (
          <img src={el.props.src} className="w-full h-full object-cover pointer-events-none" style={{ borderRadius: contentStyle.borderRadius }} />
        )}

        {(el.type === ElementType.TEXT || el.type === ElementType.SHAPE) && (
          <div style={contentStyle} className="p-2 whitespace-pre-wrap text-center">
            {el.props.text}
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-black relative overflow-hidden transition-colors">

      <div
        ref={containerRef}
        className="relative shadow-2xl bg-white dark:bg-gray-900 overflow-hidden transition-colors group"
        style={{ width: '80%', aspectRatio: '16/9' }}
        onClick={() => onSelectElement(null)}
      >
        {elements.filter(e => e.type === ElementType.AUDIO && e.props.src).map(el => (
          <audio key={el.id} data-element-id={el.id} src={el.props.src} />
        ))}

        {/* Sort by zIndex for proper layering */}
        {[...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map(renderVisualElement)}
      </div>

      {/* Transport Controls */}
      <div className="absolute bottom-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-full px-6 py-3 flex items-center space-x-6 z-50 shadow-lg border border-gray-200 dark:border-gray-700 transition-colors">
        <button className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition" onClick={() => onTimeUpdate(0)}>
          <span className="text-xs font-mono">|&lt;</span>
        </button>
        <button
          onClick={togglePlay}
          className="w-10 h-10 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black hover:bg-gray-700 dark:hover:bg-gray-200 transition"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon className="ml-1" />}
        </button>
        <div className="text-xs font-mono text-gray-700 dark:text-gray-300">
          {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  );
});

export default VideoPreview;