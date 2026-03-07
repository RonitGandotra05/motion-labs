
import React, { useEffect, useRef, useState } from 'react';

interface WaveformProps {
    audioUrl: string;
    clipDuration: number;
    mediaOffset?: number;
    color?: string;
    height?: number;
}

const audioBufferCache = new Map<string, Promise<AudioBuffer>>();

const loadAudioBuffer = async (audioUrl: string) => {
    const existing = audioBufferCache.get(audioUrl);
    if (existing) return existing;

    const promise = (async () => {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();

        try {
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            return await audioContext.decodeAudioData(arrayBuffer);
        } finally {
            audioContext.close().catch(() => { });
        }
    })();

    audioBufferCache.set(audioUrl, promise);
    return promise;
};

const Waveform: React.FC<WaveformProps> = ({ audioUrl, clipDuration, mediaOffset = 0, color = 'rgba(0, 0, 0, 0.32)', height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [error, setError] = useState<boolean>(false);

    useEffect(() => {
        let isMounted = true;

        const fetchAudio = async () => {
            try {
                const decodedBuffer = await loadAudioBuffer(audioUrl);

                if (isMounted) {
                    setAudioBuffer(decodedBuffer);
                    setError(false);
                }
            } catch (err) {
                console.error("Error generating waveform:", err);
                if (isMounted) setError(true);
            }
        };

        fetchAudio();

        return () => {
            isMounted = false;
        };
    }, [audioUrl]);

    useEffect(() => {
        if (!audioBuffer || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const renderHeight = height || rect.height;
        const renderWidth = Math.max(1, Math.floor(rect.width));
        const centerY = renderHeight / 2;
        const sourceDuration = audioBuffer.duration || 0;
        const safeClipDuration = Math.max(clipDuration, 0.01);
        const clampedOffset = Math.max(0, Math.min(mediaOffset, Math.max(sourceDuration - 0.01, 0)));
        const endTime = Math.min(sourceDuration, clampedOffset + safeClipDuration);
        const startSample = Math.floor(clampedOffset * audioBuffer.sampleRate);
        const endSample = Math.min(audioBuffer.length, Math.ceil(endTime * audioBuffer.sampleRate));
        const visibleSamples = Math.max(1, endSample - startSample);
        const samplesPerPixel = Math.max(1, Math.floor(visibleSamples / renderWidth));
        const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));

        canvas.width = renderWidth * dpr;
        canvas.height = renderHeight * dpr;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, renderWidth, renderHeight);

        ctx.fillStyle = color;
        ctx.globalAlpha = 1;
        ctx.fillRect(0, centerY, renderWidth, 1);

        for (let x = 0; x < renderWidth; x++) {
            const chunkStart = startSample + (x * samplesPerPixel);
            const chunkEnd = Math.min(endSample, chunkStart + samplesPerPixel);
            let peak = 0;

            for (let sampleIndex = chunkStart; sampleIndex < chunkEnd; sampleIndex++) {
                for (const channel of channelData) {
                    const amplitude = Math.abs(channel[sampleIndex] || 0);
                    if (amplitude > peak) peak = amplitude;
                }
            }

            const barHeight = Math.max(1.5, peak * (renderHeight * 0.48));
            ctx.fillRect(x, centerY - barHeight, 1, barHeight * 2);
        }
    }, [audioBuffer, clipDuration, color, height, mediaOffset]);

    if (error) return null;

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full absolute inset-0 pointer-events-none"
            style={{ height: height ? `${height}px` : '100%' }}
        />
    );
};

export default Waveform;
