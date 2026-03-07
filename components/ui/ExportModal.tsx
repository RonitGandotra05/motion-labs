import React, { useEffect, useState } from 'react';
import { DownloadIcon } from './Icons';
import { ExportFormatOption, ExportOptions, ExportPreset, getExportDimensions } from '../../utils/exportVideo';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (options: ExportOptions) => Promise<void>;
    duration: number;
    aspectRatio: string;
    formats: ExportFormatOption[];
    presets: ExportPreset[];
    isExporting: boolean;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport, duration, aspectRatio, formats, presets, isExporting }) => {
    const [filename, setFilename] = useState(`project_${new Date().toISOString().slice(0, 10)}`);
    const [fps, setFps] = useState(30);
    const [presetId, setPresetId] = useState<ExportPreset['id']>('full-hd');
    const [formatMimeType, setFormatMimeType] = useState(formats[0]?.mimeType || 'video/webm');
    const selectedPreset = presets.find((preset) => preset.id === presetId) || presets[0];
    const dimensions = selectedPreset ? getExportDimensions(aspectRatio, selectedPreset.id) : { width: 1920, height: 1080 };

    useEffect(() => {
        if (formats.length > 0) {
            setFormatMimeType(formats[0].mimeType);
        }
    }, [formats]);

    if (!isOpen) return null;

    const handleExportClick = async () => {
        await onExport({
            filename,
            fps,
            presetId,
            mimeType: formatMimeType,
            bitrateMbps: selectedPreset?.bitrateMbps || 14
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
            <div className="relative w-[400px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl p-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <DownloadIcon className="w-5 h-5" />
                    Export Video
                </h2>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Filename</label>
                        <div className="flex items-center">
                            <input
                                type="text"
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-l px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                                placeholder="My Video"
                            />
                            <span className="bg-gray-100 dark:bg-gray-800 border-y border-r border-gray-300 dark:border-gray-700 rounded-r px-3 py-2 text-sm text-gray-500">
                                .webm
                            </span>
                        </div>
                    </div>

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
                                    <div className="text-[11px] opacity-80">{getExportDimensions(aspectRatio, preset.id).width}x{getExportDimensions(aspectRatio, preset.id).height}</div>
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
                                Export is unavailable in this browser.
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
                        <p>Estimated Duration: {duration} seconds</p>
                        <p className="mt-1 opacity-75">Output: {dimensions.width}x{dimensions.height} at {fps} FPS</p>
                        <p className="mt-1 opacity-75">Codec: {formats.find((format) => format.mimeType === formatMimeType)?.label || 'WebM'}</p>
                    </div>
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
                        disabled={!filename || isExporting || formats.length === 0}
                        className={`px-4 py-2 rounded text-sm font-medium text-white transition shadow-sm flex items-center gap-2 ${!filename ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        <DownloadIcon className="w-4 h-4" />
                        {isExporting ? 'Exporting...' : 'Start Export'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
