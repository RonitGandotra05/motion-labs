import React, { useState, useEffect, useRef } from 'react';
import { TypeIcon, SquareIcon, UploadIcon, SparklesIcon, VideoIcon, MusicIcon, ImageIcon, PlusIcon, PlayIcon, LayersIcon, TrashIcon, MonitorIcon, CameraIcon } from '../ui/Icons';
import { ElementType } from '../../types';
import { generateComponentConfig, generateImage, getStoredApiKey } from '../../services/geminiService';
import { saveAsset, getAssets, deleteAsset, MediaAsset } from '../../utils/db';
import { ConfirmDialog, InputDialog } from '../ui/Modal';

interface AssetsPanelProps {
  onAddElement: (type: ElementType, props?: any) => void;
  onUploadMedia: (file: File, type: ElementType) => void;
  panelWidth?: number;
  onOpenSettings?: () => void;
}

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'mpeg', 'mpg', '3gp', 'ogv', 'wmv', 'flv', 'f4v', 'ts', 'm2ts', 'mts', 'asf', 'qt', 'vob'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'aiff', 'aif', 'weba', 'wma', 'alac', 'amr', 'opus', 'mid', 'midi', 'mp2', 'ac3'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif', 'heic', 'heif', 'tif', 'tiff', 'ico', 'raw', 'dng'];

const AssetsPanel: React.FC<AssetsPanelProps> = ({ onAddElement, panelWidth, onOpenSettings }) => {
  const [activeTab, setActiveTab] = useState<'library' | 'image'>('library');
  const [libraryAssets, setLibraryAssets] = useState<MediaAsset[]>([]);

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

    const files = Array.from(e.target.files);
    for (const file of files) {
      const assetType = getAssetTypeForFile(file);
      if (!assetType) continue;
      await saveAsset(file, assetType, file.name);
    }

    await refreshLibrary();
    e.target.value = '';
  };

  const handleAddToTimeline = (asset: MediaAsset) => {
    const url = URL.createObjectURL(asset.blob);
    onAddElement(asset.type, { src: url, name: asset.name, assetId: asset.id });
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

  return (
    <div
      className="relative flex h-full min-w-0 w-full flex-col overflow-x-hidden border-r border-gray-200 bg-white transition-colors dark:border-gray-800 dark:bg-gray-900"
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

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => setActiveTab('library')} className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === 'library' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>Library</button>
        <button onClick={() => setActiveTab('image')} className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === 'image' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>Image Gen</button>
      </div>

      <div className="flex-1 space-y-6 overflow-x-hidden overflow-y-auto p-4 custom-scrollbar">

        {activeTab === 'library' && (
          <>
            {/* Recording Actions */}
            <div className="space-y-2">
              <h3 className="text-[10px] text-gray-500 dark:text-gray-500 uppercase font-bold">Record</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => startRecording(ElementType.VIDEO, 'camera')}
                  className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 group border border-transparent hover:border-red-500/30 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                    <CameraIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">Camera</span>
                </button>
                <button
                  onClick={() => startRecording(ElementType.VIDEO, 'screen')}
                  className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-800 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 group border border-transparent hover:border-purple-500/30 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                    <MonitorIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">Screen</span>
                </button>
                <button
                  onClick={() => startRecording(ElementType.AUDIO, 'camera')}
                  className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-800 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 group border border-transparent hover:border-blue-500/30 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                    <MusicIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">Audio</span>
                </button>
                <button
                  onClick={startPhotoCapture}
                  className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-800 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 group border border-transparent hover:border-emerald-500/30 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                    <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">Photo</span>
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <h3 className="text-xs text-gray-500 dark:text-gray-500 uppercase font-bold mb-3 flex justify-between items-center">
                Resource Manager
                <label className="cursor-pointer text-blue-500 hover:text-blue-400 text-[10px] flex items-center bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                  <PlusIcon className="w-3 h-3 mr-1" /> Import
                  <input type="file" className="hidden" multiple onChange={handleFileUpload} />
                </label>
              </h3>
              <p className="mb-3 text-[10px] text-gray-500 dark:text-gray-400">
                Mixed imports supported across common audio, video, and photo formats, including MP4, MOV, MKV, MP3, WAV, FLAC, PNG, JPG, HEIC, TIFF and more.
              </p>

              <div
                className="min-h-[100px] space-y-2 rounded-lg border-2 border-dashed border-transparent transition-colors hover:border-blue-300 dark:hover:border-blue-700"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {libraryAssets.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs italic pointer-events-none">
                    Library is empty. <br />Record, Import, or Drag & Drop media here.
                  </div>
                )}
                {libraryAssets.map(asset => (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, asset)}
                    className="group flex items-center p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors cursor-grab active:cursor-grabbing"
                    onClick={() => handleAddToTimeline(asset)}
                  >
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-900 rounded flex-shrink-0 flex items-center justify-center mr-3 text-gray-500">
                      {asset.type === ElementType.VIDEO && <VideoIcon className="w-5 h-5" />}
                      {asset.type === ElementType.AUDIO && <MusicIcon className="w-5 h-5" />}
                      {asset.type === ElementType.IMAGE && <ImageIcon className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-200 truncate" title={asset.name}>{asset.name}</p>
                      <p className="text-[10px] text-gray-500">{new Date(asset.createdAt).toLocaleTimeString()}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteAsset(asset.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/50 rounded text-red-500 transition"
                      title="Delete from library"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <h3 className="text-xs text-gray-500 dark:text-gray-500 uppercase font-bold mb-3">UI Components</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => onAddElement(ElementType.TEXT)} className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
                  <TypeIcon className="w-5 h-5 mb-1 text-blue-500 dark:text-blue-400" />
                  <span className="text-xs text-gray-700 dark:text-gray-200">Text</span>
                </button>
                <button onClick={() => onAddElement(ElementType.SHAPE)} className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
                  <SquareIcon className="w-5 h-5 mb-1 text-green-500 dark:text-green-400" />
                  <span className="text-xs text-gray-700 dark:text-gray-200">Shape</span>
                </button>
                <button onClick={() => onAddElement(ElementType.ADJUSTMENT)} className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors col-span-2">
                  <LayersIcon className="w-5 h-5 mb-1 text-orange-500 dark:text-orange-400" />
                  <span className="text-xs text-gray-700 dark:text-gray-200">Adjustment Layer</span>
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 transition-colors mt-3">
                <h4 className="text-[10px] font-bold text-gray-400 mb-1 uppercase">AI Animated Components</h4>
                <input className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white mb-2 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Ringing Bell Button" value={prompt} onChange={(e) => setPrompt(e.target.value)} />

                <button onClick={handleComponentGenerate} disabled={isGenerating} className="w-full bg-blue-600 hover:bg-blue-500 text-xs py-1 rounded text-white disabled:opacity-50 transition-colors">
                  {isGenerating ? 'Generating...' : 'Create Component'}
                </button>

                {isGenerating && (
                  <div className="mt-2 w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-[pulse_1s_ease-in-out_infinite] w-2/3 ml-[-50%]"></div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'image' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/50 dark:to-purple-900/50 p-4 rounded-xl border border-indigo-200 dark:border-indigo-700 transition-colors">
              <h3 className="text-xs text-indigo-700 dark:text-indigo-200 font-bold mb-2 flex items-center"><SparklesIcon className="w-3 h-3 mr-1" /> AI Image Generation</h3>
              <textarea
                className="w-full bg-white/80 dark:bg-black/30 border border-indigo-200 dark:border-indigo-500/30 rounded p-2 text-xs text-gray-900 dark:text-white mb-3 focus:outline-none resize-none"
                rows={3} placeholder="A cyberpunk dog eating noodles..."
                value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)}
                disabled={isGenerating}
              />
              <button onClick={handleImageGenerate} disabled={isGenerating || !imgPrompt.trim()} className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 rounded text-xs font-bold text-white transition disabled:opacity-50 shadow-md flex items-center justify-center">
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                  <div className="flex items-center justify-center text-xs text-indigo-600 dark:text-indigo-300">
                    <SparklesIcon className="w-3 h-3 mr-1 animate-pulse" />
                    Creating your image with AI...
                  </div>
                  <div className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '100%', backgroundSize: '200% 100%' }}></div>
                  </div>
                  <p className="text-[10px] text-center text-gray-500 dark:text-gray-400">Image will be saved to your library</p>
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
        title="Delete Asset"
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
