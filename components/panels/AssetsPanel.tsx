import React, { useState, useEffect, useRef } from 'react';
import { TypeIcon, SquareIcon, UploadIcon, SparklesIcon, VideoIcon, MusicIcon, ImageIcon, PlusIcon, PlayIcon, LayersIcon, TrashIcon, MonitorIcon, CameraIcon } from '../ui/Icons';
import { ElementType } from '../../types';
import { generateComponentConfig, generateImage, getStoredApiKey } from '../../services/geminiService';
import { saveAsset, getAssets, deleteAsset, MediaAsset } from '../../utils/db';
import { ConfirmDialog, InputDialog } from '../ui/Modal';

interface AssetsPanelProps {
  onAddElement: (type: ElementType, props?: any) => void;
  onUploadMedia: (file: File, type: ElementType) => void;
  onPreviewClip?: (clip: { name: string; type: ElementType; src: string; assetId?: string }) => void;
  panelWidth?: number;
  onOpenSettings?: () => void;
}

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'mpeg', 'mpg', '3gp', 'ogv', 'wmv', 'flv', 'f4v', 'ts', 'm2ts', 'mts', 'asf', 'qt', 'vob'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'aiff', 'aif', 'weba', 'wma', 'alac', 'amr', 'opus', 'mid', 'midi', 'mp2', 'ac3'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif', 'heic', 'heif', 'tif', 'tiff', 'ico', 'raw', 'dng'];

const AssetsPanel: React.FC<AssetsPanelProps> = ({ onAddElement, onPreviewClip, panelWidth, onOpenSettings }) => {
  const [activeTab, setActiveTab] = useState<'library' | 'image'>('library');
  const [assetViewMode, setAssetViewMode] = useState<'sequence' | 'grid'>('sequence');
  const [libraryAssets, setLibraryAssets] = useState<MediaAsset[]>([]);
  const [assetPreviewUrls, setAssetPreviewUrls] = useState<Record<string, string>>({});
  const assetPreviewUrlsRef = useRef<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [assetPreviewSize, setAssetPreviewSize] = useState(64);

  // Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [recordingType, setRecordingType] = useState<ElementType.VIDEO | ElementType.AUDIO | null>(null);
  const [recordingMode, setRecordingMode] = useState<'camera' | 'screen' | null>(null);
  const [showRecordingOptions, setShowRecordingOptions] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const photoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // Generator State
  const [prompt, setPrompt] = useState('');
  const [imgPrompt, setImgPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal States
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; assetId: string | null }>({ isOpen: false, assetId: null });
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    refreshLibrary();
  }, []);

  useEffect(() => {
    setAssetPreviewUrls(prev => {
      const next = { ...prev };
      const activeIds = new Set(libraryAssets.map(asset => asset.id));

      libraryAssets.forEach(asset => {
        if (!next[asset.id]) {
          next[asset.id] = URL.createObjectURL(asset.blob);
        }
      });

      Object.entries(next).forEach(([assetId, url]) => {
        if (!activeIds.has(assetId)) {
          URL.revokeObjectURL(url);
          delete next[assetId];
        }
      });

      return next;
    });
  }, [libraryAssets]);

  useEffect(() => {
    assetPreviewUrlsRef.current = assetPreviewUrls;
  }, [assetPreviewUrls]);

  useEffect(() => {
    return () => {
      Object.values(assetPreviewUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const clearRecordingPreview = () => {
    if (videoPreviewRef.current) {
      videoPreviewRef.current.pause();
      videoPreviewRef.current.srcObject = null;
    }
  };

  const getRecorderMimeType = (type: ElementType.VIDEO | ElementType.AUDIO) => {
    if (typeof MediaRecorder === 'undefined') {
      return '';
    }

    const preferredTypes = type === ElementType.AUDIO
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

    return preferredTypes.find(mimeType => MediaRecorder.isTypeSupported(mimeType)) || '';
  };

  const getRecordingErrorMessage = (
    error: unknown,
    mode: 'camera' | 'screen',
    type: ElementType.VIDEO | ElementType.AUDIO
  ) => {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        if (mode === 'screen') {
          return 'Screen sharing was blocked. Allow screen access in your browser and try again.';
        }

        return type === ElementType.AUDIO
          ? 'Microphone access was blocked. Allow microphone access in your browser and try again.'
          : 'Camera or microphone access was blocked. Allow both in your browser and try again.';
      }

      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return type === ElementType.AUDIO
          ? 'No microphone was found on this device.'
          : 'No camera or microphone was found on this device.';
      }

      if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        return 'The selected camera, microphone, or screen is busy in another app. Close the other app and retry.';
      }

      if (error.name === 'NotSupportedError') {
        return 'This browser cannot record with the current media settings. Try Chrome or Edge on desktop.';
      }
    }

    return mode === 'screen'
      ? 'Could not share your screen. Please check your browser permissions or try a different browser.'
      : 'Could not access your camera or microphone. Please check your browser permissions.';
  };

  const getPermissionState = async (name: 'microphone' | 'camera') => {
    if (!('permissions' in navigator) || !navigator.permissions?.query) {
      return 'unknown';
    }

    try {
      const status = await navigator.permissions.query({ name } as PermissionDescriptor);
      return status.state;
    } catch {
      return 'unknown';
    }
  };

  const getBlockedPermissionMessage = (type: ElementType.VIDEO | ElementType.AUDIO, mode: 'camera' | 'screen') => {
    if (mode === 'screen') {
      return 'Screen sharing is not available right now. Please allow it and try again.';
    }

    return type === ElementType.AUDIO
      ? 'Microphone access is blocked. Please allow it and try again.'
      : 'Camera or microphone access is blocked. Please allow it and try again.';
  };

  const ensurePermissionsReady = async (
    type: ElementType.VIDEO | ElementType.AUDIO,
    mode: 'camera' | 'screen'
  ) => {
    if (!window.isSecureContext) {
      setErrorModal({
        isOpen: true,
        title: 'Secure Context Required',
        message: 'Recording is not available right now in this browser tab.'
      });
      return false;
    }

    if (mode === 'screen') {
      return true;
    }

    const microphoneState = await getPermissionState('microphone');
    if (microphoneState === 'denied') {
      setErrorModal({
        isOpen: true,
        title: 'Microphone Blocked',
        message: getBlockedPermissionMessage(type, mode)
      });
      return false;
    }

    if (type === ElementType.VIDEO) {
      const cameraState = await getPermissionState('camera');
      if (cameraState === 'denied') {
        setErrorModal({
          isOpen: true,
          title: 'Camera Blocked',
          message: getBlockedPermissionMessage(type, mode)
        });
        return false;
      }
    }

    return true;
  };

  const refreshLibrary = async () => {
    const assets = await getAssets();
    setLibraryAssets(assets);
  };

  const getAssetTypeForFile = (file: File) => {
    const normalizedType = file.type.toLowerCase();
    if (normalizedType.startsWith('video/') || normalizedType.includes('video')) return ElementType.VIDEO;
    if (normalizedType.startsWith('audio/') || normalizedType.includes('audio') || normalizedType === 'application/ogg') return ElementType.AUDIO;
    if (normalizedType.startsWith('image/') || normalizedType.includes('image')) return ElementType.IMAGE;

    const lowerName = file.name.toLowerCase();
    const extension = lowerName.includes('.') ? lowerName.split('.').pop() : '';
    if (!extension) return null;

    if (VIDEO_EXTENSIONS.includes(extension)) return ElementType.VIDEO;
    if (AUDIO_EXTENSIONS.includes(extension)) return ElementType.AUDIO;
    if (IMAGE_EXTENSIONS.includes(extension)) return ElementType.IMAGE;

    return null;
  };

  const stopPhotoCapture = () => {
    photoStreamRef.current?.getTracks().forEach(track => track.stop());
    photoStreamRef.current = null;
    clearRecordingPreview();
    setIsCapturingPhoto(false);
  };

  // -- Library & Upload Logic --
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const fileList = Array.from(e.target.files) as File[];
    setImportProgress({ current: 0, total: fileList.length });

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setImportProgress({ current: i + 1, total: fileList.length });
      const assetType = getAssetTypeForFile(file);
      if (!assetType) continue;
      await saveAsset(file, assetType, file.name);
    }

    setImportProgress(null);
    await refreshLibrary();
    e.target.value = '';
  };

  const handleAddToTimeline = (asset: MediaAsset) => {
    const url = assetPreviewUrls[asset.id] || URL.createObjectURL(asset.blob);
    onAddElement(asset.type, { src: url, name: asset.name, assetId: asset.id });
  };

  const handlePreviewClip = (asset: MediaAsset) => {
    if (onPreviewClip) {
      const url = assetPreviewUrls[asset.id] || URL.createObjectURL(asset.blob);
      onPreviewClip({ name: asset.name, type: asset.type, src: url, assetId: asset.id });
    }
  };

  const renderAssetPreview = (asset: MediaAsset) => {
    const previewUrl = assetPreviewUrls[asset.id];
    const previewSize = `${assetPreviewSize}px`;

    if (asset.type === ElementType.VIDEO && previewUrl) {
      return (
        <video
          src={previewUrl}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      );
    }

    if (asset.type === ElementType.IMAGE && previewUrl) {
      return <img src={previewUrl} alt={asset.name} className="h-full w-full object-cover" />;
    }

    return (
      <div
        className={`flex h-full w-full items-center justify-center ${asset.type === ElementType.AUDIO ? 'bg-gradient-to-br from-[#173422] via-[#1f5a37] to-[#2b7a52]' : 'bg-gradient-to-br from-[#20242b] via-[#2d4058] to-[#4a6a8f]'}`}
        style={{ width: previewSize, height: previewSize }}
      >
        {asset.type === ElementType.VIDEO && <VideoIcon className="h-6 w-6 text-white/75" />}
        {asset.type === ElementType.AUDIO && <MusicIcon className="h-6 w-6 text-white/75" />}
        {asset.type === ElementType.IMAGE && <ImageIcon className="h-6 w-6 text-white/75" />}
      </div>
    );
  };

  // OS File Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];

      for (const file of files) {
        const assetType = getAssetTypeForFile(file);
        if (!assetType) continue;
        await saveAsset(file, assetType, file.name);
      }
      await refreshLibrary();
    }
  };

  const handleDragStart = (e: React.DragEvent, asset: MediaAsset) => {
    e.dataTransfer.setData('application/react-frame-asset-id', asset.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDeleteAsset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, assetId: id });
  };

  const confirmDeleteAsset = async () => {
    if (deleteConfirm.assetId) {
      await deleteAsset(deleteConfirm.assetId);
      refreshLibrary();
    }
  };

  // -- Recorder Logic --
  const startRecording = async (type: ElementType.VIDEO | ElementType.AUDIO, mode: 'camera' | 'screen' = 'camera') => {
    try {
      if (!navigator.mediaDevices) {
        throw new Error('MediaDevicesUnavailable');
      }

      if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorderUnavailable');
      }

      const permissionsReady = await ensurePermissionsReady(type, mode);
      if (!permissionsReady) {
        return;
      }

      setRecordingType(type);
      setRecordingMode(mode);

      let stream: MediaStream;
      let previewStream: MediaStream; // Separate stream for preview

      if (type === ElementType.AUDIO) {
        // Audio only recording
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        previewStream = stream;
      } else if (mode === 'screen') {
        // Screen share recording with optional audio
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          } as any,
          audio: true // Request system audio (user can choose to share)
        });

        // Use display stream for preview
        previewStream = displayStream;

        // Try to get microphone audio as well for narration
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          const audioContext = new AudioContext();
          const destination = audioContext.createMediaStreamDestination();

          // Mix both audio streams
          const displayAudio = displayStream.getAudioTracks();
          const micAudio = micStream.getAudioTracks();

          if (displayAudio.length > 0) {
            const displaySource = audioContext.createMediaStreamSource(new MediaStream(displayAudio));
            displaySource.connect(destination);
          }
          if (micAudio.length > 0) {
            const micSource = audioContext.createMediaStreamSource(new MediaStream(micAudio));
            micSource.connect(destination);
          }

          // Create combined stream for recording
          stream = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...destination.stream.getAudioTracks()
          ]);

          // Store cleanup for mic stream
          displayStream.getVideoTracks()[0].onended = () => {
            micStream.getTracks().forEach(t => t.stop());
          };
        } catch (micErr) {
          // Mic not available, use display stream only
          stream = displayStream;
        }
      } else {
        // Camera recording
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        previewStream = stream;
      }

      // Set up video preview
      if (videoPreviewRef.current && type === ElementType.VIDEO) {
        videoPreviewRef.current.srcObject = previewStream;
        videoPreviewRef.current.muted = true;
        try {
          await videoPreviewRef.current.play();
        } catch (playErr) {
          console.log('Auto-play prevented, user interaction may be needed');
        }
      }

      const mimeType = getRecorderMimeType(type);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blobType = recorder.mimeType || mimeType || (type === ElementType.VIDEO ? 'video/webm' : 'audio/webm');
        const blob = new Blob(chunks, { type: blobType });
        // Stop stream tracks
        stream.getTracks().forEach(track => track.stop());
        previewStream.getTracks().forEach(track => {
          if (!stream.getTracks().includes(track)) {
            track.stop();
          }
        });
        clearRecordingPreview();

        // Save to DB
        const modeLabel = mode === 'screen' ? 'Screen' : 'Camera';
        const name = `${modeLabel} Recording ${new Date().toLocaleTimeString()}`;
        await saveAsset(blob, type, name);
        await refreshLibrary();
        setIsRecording(false);
        setRecordingType(null);
        setRecordingMode(null);
        setRecordingTime(0);
      };

      // Handle when user stops screen share from browser UI
      if (mode === 'screen') {
        stream.getVideoTracks()[0].onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        };
      }

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Timer
      const interval = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

      // Cleanup timer on stop
      const originalStop = recorder.stop;
      recorder.stop = () => {
        clearInterval(interval);
        MediaRecorder.prototype.stop.call(recorder);
      };

    } catch (err) {
      console.error("Error accessing media devices:", err);
      clearRecordingPreview();
      const errorMessage =
        err instanceof Error && err.message === 'MediaDevicesUnavailable'
          ? 'Camera or microphone access is not available right now.'
          : err instanceof Error && err.message === 'MediaRecorderUnavailable'
            ? 'Recording is not supported in this browser.'
            : getRecordingErrorMessage(err, mode, type);
      setErrorModal({ isOpen: true, title: 'Recording Error', message: errorMessage });
      setIsRecording(false);
      setRecordingType(null);
      setRecordingMode(null);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const startPhotoCapture = async () => {
    try {
      if (!navigator.mediaDevices) {
        throw new Error('MediaDevicesUnavailable');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user'
        },
        audio: false
      });

      photoStreamRef.current = stream;
      setIsCapturingPhoto(true);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        videoPreviewRef.current.playsInline = true;
        await videoPreviewRef.current.play();
      }
    } catch (err) {
      console.error('Error accessing camera for photo capture:', err);
      stopPhotoCapture();
      const errorMessage =
        err instanceof Error && err.message === 'MediaDevicesUnavailable'
          ? 'Camera access is not available right now.'
          : 'Could not access your camera for photo capture. Please check your browser permissions.';
      setErrorModal({ isOpen: true, title: 'Photo Capture Error', message: errorMessage });
    }
  };

  const capturePhoto = async () => {
    const video = videoPreviewRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      setErrorModal({ isOpen: true, title: 'Photo Capture Error', message: 'Could not capture a frame from the camera preview.' });
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });

    if (!blob) {
      setErrorModal({ isOpen: true, title: 'Photo Capture Error', message: 'The browser could not generate an image file from this frame.' });
      return;
    }

    const name = `Photo ${new Date().toLocaleTimeString()}.png`;
    await saveAsset(blob, ElementType.IMAGE, name);
    await refreshLibrary();
    stopPhotoCapture();
  };

  // -- Generators --
  const handleComponentGenerate = async () => {
    if (!prompt.trim()) return;
    if (!getStoredApiKey()) {
      setErrorModal({ isOpen: true, title: 'API Key Required', message: 'Please add your Gemini API key in Settings to use AI generation.' });
      if (onOpenSettings) onOpenSettings();
      return;
    }
    setIsGenerating(true);
    const config = await generateComponentConfig(prompt);
    if (config) {
      onAddElement(ElementType.AI_GENERATED, { ...config.props, name: config.name || 'AI Component' });
    }
    setIsGenerating(false);
  };

  const handleImageGenerate = async () => {
    if (!imgPrompt.trim()) return;
    if (!getStoredApiKey()) {
      setErrorModal({ isOpen: true, title: 'API Key Required', message: 'Please add your Gemini API key in Settings to use Image Generation.' });
      if (onOpenSettings) onOpenSettings();
      return;
    }
    setIsGenerating(true);
    try {
      const base64 = await generateImage(imgPrompt);
      if (base64) {
        // Convert base64 to blob for storage
        const response = await fetch(base64);
        const blob = await response.blob();

        // Generate unique name based on prompt
        const timestamp = Date.now();
        const shortPrompt = imgPrompt.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
        const imageName = `AI_${shortPrompt}_${timestamp}`;

        // Save to library
        await saveAsset(blob, ElementType.IMAGE, imageName);

        // Refresh library to show new asset
        await refreshLibrary();

        // Also add to canvas
        onAddElement(ElementType.IMAGE, { src: base64, name: imageName });

        // Clear prompt after success
        setImgPrompt('');
      }
    } catch (error: any) {
      console.error('Image generation error:', error);

      // Check for rate limit error
      if (error?.message?.startsWith('RATE_LIMIT:')) {
        const retryTime = error.message.split(':')[1] || '60';
        setErrorModal({
          isOpen: true,
          title: 'API Rate Limit Reached',
          message: `You've exceeded the Gemini API quota for image generation. The free tier may have limited or no access to this model.\n\n• Try again in ${retryTime} seconds\n• Consider upgrading your API plan at ai.google.dev\n• Or use the Import button to add your own images`
        });
      } else {
        setErrorModal({ isOpen: true, title: 'Generation Failed', message: 'Failed to generate image. Please try again or check your API quota.' });
      }
    }
    setIsGenerating(false);
  };

  const [showRecordSection, setShowRecordSection] = useState(false);

  return (
    <div
      className="relative flex h-full min-w-0 w-full flex-col overflow-x-hidden bg-pp-dark text-pp-text transition-colors"
      style={{
        width: panelWidth ? `${panelWidth}px` : '280px',
        maxWidth: '100%'
      }}
    >

      {/* Recording Overlay */}
      {(isRecording || isCapturingPhoto) && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="flex items-center gap-2 text-white mb-2">
            <div className={`w-3 h-3 rounded-full ${isCapturingPhoto ? 'bg-emerald-500' : `animate-pulse ${recordingMode === 'screen' ? 'bg-purple-500' : 'bg-red-500'}`}`}></div>
            <span className="text-xs font-semibold uppercase">
              {isCapturingPhoto ? 'Photo' : recordingType === ElementType.AUDIO ? 'Audio' : recordingMode === 'screen' ? 'Screen' : 'Camera'}
            </span>
          </div>
          {!isCapturingPhoto && (
            <div className="text-white mb-4 text-xl font-mono">
              {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
            </div>
          )}
          {(recordingType === ElementType.VIDEO || isCapturingPhoto) && (
            <video ref={videoPreviewRef} className="w-full aspect-video bg-black border border-gray-700 rounded mb-4" muted />
          )}
          {recordingType === ElementType.AUDIO && (
            <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center animate-pulse mb-4">
              <MusicIcon className="w-12 h-12 text-blue-400" />
            </div>
          )}
          {isCapturingPhoto ? (
            <div className="flex items-center gap-3">
              <button
                onClick={stopPhotoCapture}
                className="rounded-full border border-gray-500 px-5 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
              >
                <ImageIcon className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={stopRecording}
                className="bg-red-600 hover:bg-red-700 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
              >
                <SquareIcon className="w-6 h-6 fill-current" />
              </button>
              <p className="text-gray-400 text-xs mt-3">Click to stop recording</p>
            </>
          )}
        </div>
      )}

      {/* Internal Tabs - Premiere Pro style */}
      <div className="flex bg-pp-dark border-b border-black/30 w-full overflow-hidden flex-shrink-0">
        <button
          onClick={() => setActiveTab('library')}
          className={`px-3 py-1 text-[11px] font-medium transition-colors ${activeTab === 'library' ? 'bg-pp-light text-white' : 'text-pp-text hover:text-white hover:bg-pp-medium'}`}
          data-tip="Project Assets & Media"
        >
          Assets
        </button>
        <button
          onClick={() => setActiveTab('image')}
          className={`px-3 py-1 text-[11px] font-medium transition-colors ${activeTab === 'image' ? 'bg-pp-light text-white' : 'text-pp-text hover:text-white hover:bg-pp-medium'}`}
          data-tip="AI Generators"
        >
          Generators
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full overflow-x-hidden overflow-y-auto custom-scrollbar flex flex-col">

        {activeTab === 'library' && (
          <div className="flex flex-col flex-1">

            {/* ═══════════ SECTION 1: RESOURCE MANAGER ═══════════ */}
            <div className="flex-1 flex flex-col">
              {/* Resource Manager Header Bar */}
              <div className="flex items-center justify-between px-3 py-[6px] bg-[#1e1e1e] border-b border-[#111] flex-shrink-0">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Resource Manager</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded border border-[#333] bg-[#181818] p-[1px]">
                    <button
                      type="button"
                      className={`px-2 py-0.5 text-[10px] ${assetViewMode === 'sequence' ? 'bg-[#2f2f2f] text-white' : 'text-gray-500 hover:text-white'}`}
                      onClick={() => setAssetViewMode('sequence')}
                      data-tip="Sequence view"
                    >
                      Seq
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-0.5 text-[10px] ${assetViewMode === 'grid' ? 'bg-[#2f2f2f] text-white' : 'text-gray-500 hover:text-white'}`}
                      onClick={() => setAssetViewMode('grid')}
                      data-tip="Grid view"
                    >
                      Grid
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    <button
                      type="button"
                      className="pp-icon-btn h-5 w-5"
                      onClick={() => setAssetPreviewSize(size => Math.max(44, size - 12))}
                      data-tip="Smaller thumbnails"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className="pp-icon-btn h-5 w-5"
                      onClick={() => setAssetPreviewSize(size => Math.min(120, size + 12))}
                      data-tip="Larger thumbnails"
                    >
                      +
                    </button>
                  </div>
                  <label className="cursor-pointer text-[#5b9bd5] hover:text-[#7cb8e8] text-[10px] flex items-center font-semibold" data-tip="Import media files">
                    <PlusIcon className="w-3 h-3 mr-1" /> IMPORT
                    <input type="file" className="hidden" multiple onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              {/* Media List / Drop Zone */}
              <div
                className="flex-1 min-h-[80px] flex flex-col"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {importProgress && (
                  <div className="text-center py-4 text-pp-text-dim text-[10px] px-4">
                    <div className="inline-block w-4 h-4 border-2 border-pp-accent border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-blue-400 font-semibold">Importing {importProgress.current}/{importProgress.total} files...</p>
                  </div>
                )}
                {libraryAssets.length === 0 && !importProgress && (
                  <div className="text-center py-6 text-pp-text-dim text-[10px] italic pointer-events-none px-4">
                    <p className="mb-1 text-gray-500">No media imported yet.</p>
                    <p className="text-gray-600">Drag & drop files here or click IMPORT above.</p>
                    <p className="text-gray-600 mt-2" style={{ fontSize: '9px' }}>
                      Supports MP4, MOV, MKV, MP3, WAV, FLAC, PNG, JPG, HEIC, TIFF and more.
                    </p>
                  </div>
                )}
                <div className={assetViewMode === 'grid' ? 'grid grid-cols-2 gap-2 p-2 md:grid-cols-3' : ''}>
                  {libraryAssets.map((asset, index) => (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, asset)}
                      className={
                        assetViewMode === 'grid'
                          ? `group relative overflow-hidden rounded border border-white/10 bg-[#1d1d1d] cursor-grab active:cursor-grabbing hover:border-[#5b9bd5]/70 hover:bg-[#252d38] transition`
                          : `group flex items-center gap-3 px-3 py-2 ${index % 2 === 0 ? 'bg-[#232323]' : 'bg-[#1e1e1e]'} hover:bg-[#2a3a4a] transition-colors cursor-grab active:cursor-grabbing border-l-[3px] ${asset.type === ElementType.VIDEO ? 'border-[#6b8aad]' : asset.type === ElementType.AUDIO ? 'border-[#4e9a4e]' : 'border-[#ad7b6b]'}`
                      }
                      onClick={() => handlePreviewClip(asset)}
                      onDoubleClick={() => handleAddToTimeline(asset)}
                      data-tip={`Click to preview "${asset.name}" • Double-click to add to timeline`}
                    >
                      <div
                        className="relative flex-shrink-0 overflow-hidden rounded border border-white/10 bg-black/30"
                        style={{
                          width: assetViewMode === 'grid' ? '100%' : `${assetPreviewSize}px`,
                          height: assetViewMode === 'grid' ? `${Math.max(88, assetPreviewSize + 18)}px` : `${assetPreviewSize}px`
                        }}
                      >
                        {renderAssetPreview(asset)}
                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                        <div className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/80">
                          {asset.type === ElementType.VIDEO ? 'Video' : asset.type === ElementType.AUDIO ? 'Audio' : 'Image'}
                        </div>
                      </div>
                      <div className={assetViewMode === 'grid' ? 'p-2' : 'flex-1 min-w-0 self-stretch py-1'}>
                        <p className="text-[11px] text-gray-200 truncate">{asset.name}</p>
                        <p className="mt-1 text-[9px] uppercase tracking-wide text-gray-500">
                          {asset.type === ElementType.VIDEO ? 'Double-click to add linked V+A' : asset.type}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteAsset(asset.id, e)}
                        className={assetViewMode === 'grid'
                          ? 'absolute right-1 top-1 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded text-gray-300 transition bg-black/40'
                          : 'opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded text-gray-500 transition self-start mt-1'}
                        data-tip="Delete from project"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══════════ SECTION 2: RECORD (Collapsible) ═══════════ */}
            <div className="border-t border-[#111] flex-shrink-0">
              <button
                onClick={() => setShowRecordSection(!showRecordSection)}
                className="flex items-center justify-between w-full px-3 py-[6px] bg-[#1e1e1e] hover:bg-[#252525] transition-colors text-left"
                data-tip="Toggle Record section"
              >
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Record</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`text-gray-500 transition-transform ${showRecordSection ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showRecordSection && (
                <div className="grid grid-cols-4 gap-[2px] p-2 bg-[#1a1a1a]">
                  <button
                    onClick={() => startRecording(ElementType.VIDEO, 'camera')}
                    className="flex flex-col items-center justify-center py-2 bg-[#262626] rounded hover:bg-[#2d2020] group transition"
                    data-tip="Record video from Camera"
                  >
                    <div className="w-7 h-7 rounded-full bg-red-900/50 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                      <CameraIcon className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <span className="text-[9px] font-medium text-gray-400">Camera</span>
                  </button>
                  <button
                    onClick={() => startRecording(ElementType.VIDEO, 'screen')}
                    className="flex flex-col items-center justify-center py-2 bg-[#262626] rounded hover:bg-[#202028] group transition"
                    data-tip="Record Screen"
                  >
                    <div className="w-7 h-7 rounded-full bg-purple-900/50 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                      <MonitorIcon className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <span className="text-[9px] font-medium text-gray-400">Screen</span>
                  </button>
                  <button
                    onClick={() => startRecording(ElementType.AUDIO, 'camera')}
                    className="flex flex-col items-center justify-center py-2 bg-[#262626] rounded hover:bg-[#20202d] group transition"
                    data-tip="Record Audio"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-900/50 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                      <MusicIcon className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <span className="text-[9px] font-medium text-gray-400">Audio</span>
                  </button>
                  <button
                    onClick={startPhotoCapture}
                    className="flex flex-col items-center justify-center py-2 bg-[#262626] rounded hover:bg-[#202d20] group transition"
                    data-tip="Capture Photo"
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-900/50 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-[9px] font-medium text-gray-400">Photo</span>
                  </button>
                </div>
              )}
            </div>

            {/* ═══════════ SECTION 3: UI COMPONENTS (Collapsible) ═══════════ */}
            <div className="border-t border-[#111] flex-shrink-0">
              <details className="group">
                <summary className="flex items-center justify-between w-full px-3 py-[6px] bg-[#1e1e1e] hover:bg-[#252525] transition-colors cursor-pointer list-none" data-tip="Toggle UI Components section">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">UI Components</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className="text-gray-500 transition-transform group-open:rotate-180">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <div className="p-2 bg-[#1a1a1a] space-y-2">
                  <div className="grid grid-cols-3 gap-[2px]">
                    <button onClick={() => onAddElement(ElementType.TEXT)} className="flex flex-col items-center py-2 bg-[#262626] rounded hover:bg-[#2a2a3a] transition" data-tip="Add Text element">
                      <TypeIcon className="w-4 h-4 mb-0.5 text-blue-400" />
                      <span className="text-[9px] text-gray-400">Text</span>
                    </button>
                    <button onClick={() => onAddElement(ElementType.SHAPE)} className="flex flex-col items-center py-2 bg-[#262626] rounded hover:bg-[#2a3a2a] transition" data-tip="Add Shape element">
                      <SquareIcon className="w-4 h-4 mb-0.5 text-green-400" />
                      <span className="text-[9px] text-gray-400">Shape</span>
                    </button>
                    <button onClick={() => onAddElement(ElementType.ADJUSTMENT)} className="flex flex-col items-center py-2 bg-[#262626] rounded hover:bg-[#3a2a2a] transition" data-tip="Add Adjustment Layer">
                      <LayersIcon className="w-4 h-4 mb-0.5 text-orange-400" />
                      <span className="text-[9px] text-gray-400">Adjust</span>
                    </button>
                  </div>
                  <div className="bg-[#262626] p-2 rounded">
                    <h4 className="text-[9px] font-bold text-gray-500 mb-1 uppercase">AI Component</h4>
                    <div className="flex gap-1">
                      <input className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500"
                        placeholder="e.g. Ringing Bell" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                      <button onClick={handleComponentGenerate} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-500 text-[10px] px-2 py-1 rounded text-white disabled:opacity-50 transition-colors whitespace-nowrap" data-tip="Generate AI Component">
                        {isGenerating ? '...' : 'Go'}
                      </button>
                    </div>
                  </div>
                </div>
              </details>
            </div>

          </div>
        )}

        {activeTab === 'image' && (
          <div className="p-3 space-y-4">
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16162a] p-4 rounded border border-[#2a2a4a] transition-colors">
              <h3 className="text-[11px] text-indigo-300 font-bold mb-3 flex items-center"><SparklesIcon className="w-3.5 h-3.5 mr-1.5" /> AI Image Generation</h3>
              <textarea
                className="w-full bg-[#111122] border border-[#333355] rounded p-2 text-[11px] text-white mb-3 focus:outline-none focus:border-indigo-500 resize-none placeholder-gray-600"
                rows={3} placeholder="A cyberpunk dog eating noodles..."
                value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)}
                disabled={isGenerating}
              />
              <button onClick={handleImageGenerate} disabled={isGenerating || !imgPrompt.trim()} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-[11px] font-bold text-white transition disabled:opacity-50 flex items-center justify-center" data-tip="Generate image using AI">
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : 'Generate Image'}
              </button>

              {/* Loading indicator */}
              {isGenerating && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-center text-[10px] text-indigo-400">
                    <SparklesIcon className="w-3 h-3 mr-1 animate-pulse" />
                    Creating your image with AI...
                  </div>
                  <div className="w-full h-1 bg-[#1a1a2e] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '100%', backgroundSize: '200% 100%' }}></div>
                  </div>
                  <p className="text-[9px] text-center text-gray-500">Image will be saved to your library</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, assetId: null })}
        onConfirm={confirmDeleteAsset}
        data-tip="Delete Asset"
        message="Are you sure you want to remove this asset from your library? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Error Modal */}
      <ConfirmDialog
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
        onConfirm={() => { }}
        title={errorModal.title}
        message={errorModal.message}
        confirmText="OK"
        cancelText=""
        variant="warning"
      />
    </div>
  );
};

export default AssetsPanel;
