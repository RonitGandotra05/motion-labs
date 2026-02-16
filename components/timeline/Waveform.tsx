
import React, { useEffect, useRef, useState } from 'react';

interface WaveformProps {
    audioUrl: string;
    duration: number; // Duration of the clip in seconds
    color?: string;
    height?: number;
}

const Waveform: React.FC<WaveformProps> = ({ audioUrl, duration, color = '#60a5fa', height = 40 }) => { // blue-400 default
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [error, setError] = useState<boolean>(false);

    // Fetch and Decode Audio
    useEffect(() => {
        let isMounted = true;
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        const fetchAudio = async () => {
            try {
                const response = await fetch(audioUrl);
                const arrayBuffer = await response.arrayBuffer();
                const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

                if (isMounted) {
                    setAudioBuffer(decodedBuffer);
                }
            } catch (err) {
                console.error("Error generating waveform:", err);
                if (isMounted) setError(true);
            }
        };

        fetchAudio();

        return () => {
            isMounted = false;
            audioContext.close();
        };
    }, [audioUrl]);

    // Draw Waveform
    useEffect(() => {
        if (!audioBuffer || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas dimensions based on container
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // We want the canvas to be the full width of the container (which represents the full duration)
        // Resolution: 100 samples per visual pixel usually enough
        canvas.width = rect.width * dpr;
        canvas.height = (height || rect.height) * dpr;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Styling
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;

        // Draw Logic
        const data = audioBuffer.getChannelData(0); // Use first channel
        const step = Math.ceil(data.length / rect.width);
        const amp = (height || rect.height) / 2;

        for (let i = 0; i < rect.width; i++) {
            let min = 1.0;
            let max = -1.0;

            // Find max/min in this chunk (pixel)
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }

            // Draw bar
            // Center the waveform vertically
            const y = (1 + min) * amp;
            const h = Math.max(1, (max - min) * amp);

            ctx.fillRect(i, y, 1, h);
        }

    }, [audioBuffer, color, height]);

    if (error) return null;

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full absolute inset-0 pointer-events-none opacity-50"
            style={{ height: height ? `${height}px` : '100%' }}
        />
    );
};

export default Waveform;
