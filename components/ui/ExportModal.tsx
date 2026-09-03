import React, { useEffect, useState, useMemo } from 'react';
import { DownloadIcon, MusicIcon, VideoIcon } from './Icons';
import {
    ExportFormatOption,
    ExportOptions,
    ExportPreset,
    ExportAudioFormatOption,
    getExportDimensions,
    getSupportedAudioFormats
} from '../../utils/exportVideo';
import { EditorElement, ElementType, Track } from '../../types';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (options: ExportOptions) => Promise<void>;
    duration: number;
    aspectRatio: string;
    formats: ExportFormatOption[];
    audioFormats?: ExportAudioFormatOption[];
    presets: ExportPreset[];
    isExporting: boolean;
    elements?: EditorElement[];
    tracks?: Track[];
    initialExportType?: 'video' | 'audio';
}

const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    onExport,
    duration,
    aspectRatio,
    formats,
    audioFormats,
    presets,
    isExporting,
    elements = [],
    initialExportType
}) => {
    const availableAudioFormats = useMemo(
        () => (audioFormats && audioFormats.length > 0 ? audioFormats : getSupportedAudioFormats()),
        [audioFormats]
    );

    const hasVisualElements = useMemo(() => {
        return elements.some(el =>
            el.type === ElementType.VIDEO ||
            el.type === ElementType.IMAGE ||
            el.type === ElementType.TEXT ||
            el.type === ElementType.SHAPE ||
            el.type === ElementType.AI_GENERATED ||
            el.type === ElementType.ADJUSTMENT
        );
    }, [elements]);

    const hasAudioElements = useMemo(() => {
        return elements.some(el =>
            el.type === ElementType.AUDIO ||
            (el.type === ElementType.VIDEO && !el.props.isMuted)
        );
    }, [elements]);

    const isAudioOnly = !hasVisualElements && hasAudioElements;
    const isVideoOnly = hasVisualElements && !hasAudioElements;
    const isEmptyTimeline = elements.length === 0;

    const [exportMediaType, setExportMediaType] = useState<'video' | 'audio'>('video');
    const [filename, setFilename] = useState(`project_${new Date().toISOString().slice(0, 10)}`);

    // Video options
    const [fps, setFps] = useState(30);
    const [presetId, setPresetId] = useState<ExportPreset['id']>('full-hd');
    const [formatMimeType, setFormatMimeType] = useState(formats[0]?.mimeType || 'video/webm');
    const selectedPreset = presets.find((preset) => preset.id === presetId) || presets[0];
    const dimensions = selectedPreset ? getExportDimensions(aspectRatio, selectedPreset.id) : { width: 1920, height: 1080 };

    // Audio options
    const [audioFormatId, setAudioFormatId] = useState<ExportAudioFormatOption['id']>('wav');
    const [sampleRate, setSampleRate] = useState<44100 | 48000>(48000);
    const [channels, setChannels] = useState<1 | 2>(2);
    const [audioBitrateKbps, setAudioBitrateKbps] = useState<number>(256);

    const selectedAudioFormat = availableAudioFormats.find(f => f.id === audioFormatId) || availableAudioFormats[0];

    // Determine initial export mode when modal opens or timeline composition changes
    useEffect(() => {
        if (!isOpen) return;

        if (initialExportType) {
            setExportMediaType(initialExportType);
        } else if (isAudioOnly) {
            setExportMediaType('audio');
        } else if (isVideoOnly) {
            setExportMediaType('video');
        } else {
            setExportMediaType('video');
        }
    }, [isOpen, initialExportType, isAudioOnly, isVideoOnly]);

    useEffect(() => {
        if (formats.length > 0) {
            setFormatMimeType(formats[0].mimeType);
        }
    }, [formats]);

    if (!isOpen) return null;

    const currentExtension = exportMediaType === 'audio'
        ? `.${selectedAudioFormat?.extension || 'wav'}`
        : '.webm';

    const handleExportClick = async () => {
        if (exportMediaType === 'audio') {
            await onExport({
                filename,
                mediaType: 'audio',
                audioFormatId,
                mimeType: selectedAudioFormat?.mimeType || 'audio/wav',
                sampleRate,
                channels,
                bitrateKbps: audioBitrateKbps
            });
        } else {
            await onExport({
                filename,
                mediaType: 'video',
                fps,
                presetId,
                mimeType: formatMimeType,
                bitrateMbps: selectedPreset?.bitrateMbps || 14
            });
        }
    };

    const isExportDisabled = !filename || isExporting || isEmptyTimeline ||
        (exportMediaType === 'video' && formats.length === 0) ||
        (exportMediaType === 'audio' && availableAudioFormats.length === 0);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
            <div className="relative w-[440px] max-w-[95vw] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        {exportMediaType === 'audio' ? (
                            <MusicIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                            <VideoIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                        {exportMediaType === 'audio' ? 'Export Audio' : 'Export Video'}
                    </h2>
                    {isAudioOnly && (
                        <span className="text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            Audio-only timeline
                        </span>
                    )}
                </div>

                {/* Media Type Switcher: Video vs Audio */}
                {hasVisualElements && hasAudioElements && (
                    <div className="mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex gap-1">
                        <button
                            type="button"
                            onClick={() => setExportMediaType('video')}
                            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                                exportMediaType === 'video'
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <VideoIcon className="w-3.5 h-3.5" />
                            Video
                        </button>
                        <button
                            type="button"
                            onClick={() => setExportMediaType('audio')}
                            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                                exportMediaType === 'audio'
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <MusicIcon className="w-3.5 h-3.5" />
                            Audio Only
                        </button>
                    </div>
                )}

                {isEmptyTimeline && (
                    <div className="mb-4 rounded border border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                        The timeline is empty. Add audio or video media to export.
                    </div>
                )}

                <div className="space-y-4">
                    {/* Filename Input */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Filename</label>
                        <div className="flex items-center">
                            <input
                                type="text"
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-l px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                                placeholder={exportMediaType === 'audio' ? 'My Audio' : 'My Video'}
                            />
                            <span className="bg-gray-100 dark:bg-gray-800 border-y border-r border-gray-300 dark:border-gray-700 rounded-r px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[58px] text-center">
                                {currentExtension}
                            </span>
                        </div>
                    </div>

                    {/* Controls for VIDEO Export */}
                    {exportMediaType === 'video' && (
                        <>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Resolution</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {presets.map((preset) => (
                                        <button
                                            key={preset.id}
                                            onClick={() => setPresetId(preset.id)}
                                            className={`rounded border px-3 py-2 text-left text-sm transition ${presetId === preset.id
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <div className="font-medium">{preset.label}</div>
                                            <div className="text-[11px] opacity-80">
                                                {getExportDimensions(aspectRatio, preset.id).width}x{getExportDimensions(aspectRatio, preset.id).height}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Frame Rate</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[24, 30, 60].map((rate) => (
                                        <button
                                            key={rate}
                                            onClick={() => setFps(rate)}
                                            className={`py-2 rounded border text-sm font-medium transition ${fps === rate
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            {rate} FPS
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Format</label>
                                {formats.length === 0 ? (
                                    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                                        Video export is unavailable in this browser.
                                    </div>
                                ) : (
                                    <select
                                        value={formatMimeType}
                                        onChange={(e) => setFormatMimeType(e.target.value)}
                                        className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                    >
                                        {formats.map((format) => (
                                            <option key={format.mimeType} value={format.mimeType}>
                                                {format.label}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-800 dark:text-blue-200">
                                <p>Estimated Duration: {Math.round(duration * 10) / 10} seconds</p>
                                <p className="mt-1 opacity-75">Output: {dimensions.width}x{dimensions.height} at {fps} FPS</p>
                                <p className="mt-1 opacity-75">Codec: {formats.find((format) => format.mimeType === formatMimeType)?.label || 'WebM'}</p>
                            </div>
                        </>
                    )}

                    {/* Controls for AUDIO Export */}
                    {exportMediaType === 'audio' && (
                        <>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Audio Format</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {availableAudioFormats.map((format) => (
                                        <button
                                            key={format.id}
                                            type="button"
                                            onClick={() => setAudioFormatId(format.id)}
                                            className={`rounded border px-3 py-2 text-left text-sm transition ${
                                                audioFormatId === format.id
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{format.label}</span>
                                                <span className="text-[11px] opacity-80 uppercase tracking-wider font-mono">.{format.extension}</span>
                                            </div>
                                            <div className="text-[11px] opacity-80 mt-0.5">{format.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Sample Rate</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {[48000, 44100].map((rate) => (
                                            <button
                                                key={rate}
                                                type="button"
                                                onClick={() => setSampleRate(rate as 44100 | 48000)}
                                                className={`py-2 rounded border text-xs font-medium transition ${
                                                    sampleRate === rate
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                {rate === 48000 ? '48 kHz' : '44.1 kHz'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Channels</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {[2, 1].map((ch) => (
                                            <button
                                                key={ch}
                                                type="button"
                                                onClick={() => setChannels(ch as 1 | 2)}
                                                className={`py-2 rounded border text-xs font-medium transition ${
                                                    channels === ch
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                {ch === 2 ? 'Stereo' : 'Mono'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {audioFormatId !== 'wav' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Bitrate</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[192, 256, 320].map((rate) => (
                                            <button
                                                key={rate}
                                                type="button"
                                                onClick={() => setAudioBitrateKbps(rate)}
                                                className={`py-1.5 rounded border text-xs font-medium transition ${
                                                    audioBitrateKbps === rate
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                {rate} kbps
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-800 dark:text-blue-200">
                                <p>Estimated Duration: {Math.round(duration * 10) / 10} seconds</p>
                                <p className="mt-1 opacity-75">
                                    Output: {selectedAudioFormat?.label || 'WAV'} ({sampleRate / 1000} kHz, {channels === 2 ? 'Stereo' : 'Mono'})
                                </p>
                                <p className="mt-1 opacity-75">Type: Pure Audio Track (Fast render)</p>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExportClick}
                        disabled={isExportDisabled}
                        className={`px-4 py-2 rounded text-sm font-medium text-white transition shadow-sm flex items-center gap-2 ${
                            isExportDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        <DownloadIcon className="w-4 h-4" />
                        {isExporting
                            ? (exportMediaType === 'audio' ? 'Exporting Audio...' : 'Exporting Video...')
                            : (exportMediaType === 'audio' ? 'Export Audio' : 'Export Video')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
