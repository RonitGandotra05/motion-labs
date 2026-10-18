import React, { useEffect, useRef, useState } from 'react';
import { subscribeWaveform, type WaveformPeaks } from '../../utils/waveformCache';
interface WaveformProps {
  audioUrl: string; clipDuration: number; mediaOffset?: number; playbackRate?: number; isReversed?: boolean;
  color?: string; height?: number; pixelsPerSecond: number; visibleStart: number; visibleWidth: number;
}
const Waveform: React.FC<WaveformProps> = ({ audioUrl, clipDuration, mediaOffset = 0, playbackRate = 1, isReversed, color = '#064c3c', height = 54, pixelsPerSecond, visibleStart, visibleWidth }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    setPeaks(null); setUnavailable(false);
    return subscribeWaveform(audioUrl, result => { setPeaks(result); setUnavailable(!result); });
  }, [audioUrl]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || visibleWidth <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.ceil(visibleWidth);
    canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, width, height); ctx.fillStyle = color;
    const binsPerPixel = peaks.binsPerSecond * playbackRate / pixelsPerSecond;
    const level = Math.max(0, Math.min(peaks.levels.length - 1, Math.floor(Math.log(Math.max(1, binsPerPixel)) / Math.log(4))));
    const resolution = peaks.binsPerSecond / 4 ** level;
    const channels = peaks.levels[level];
    channels.forEach((data, channel) => {
      const laneHeight = height / channels.length;
      const center = (channel + 0.5) * laneHeight;
      ctx.globalAlpha = 0.3; ctx.fillRect(0, center, width, 0.5); ctx.globalAlpha = 1;
      for (let x = 0; x < width; x++) {
        const t1 = (visibleStart + x) / pixelsPerSecond;
        const t2 = Math.min(clipDuration, (visibleStart + x + 1) / pixelsPerSecond);
        const a = mediaOffset + (isReversed ? clipDuration - t2 : t1) * playbackRate;
        const b = mediaOffset + (isReversed ? clipDuration - t1 : t2) * playbackRate;
        let min = 0, max = 0;
        for (let i = Math.max(0, Math.floor(a * resolution)); i < Math.min(data.length / 2, Math.max(Math.floor(a * resolution) + 1, Math.ceil(b * resolution))); i++) {
          min = Math.min(min, data[i * 2]); max = Math.max(max, data[i * 2 + 1]);
        }
        // Silence stays on the baseline instead of synthetic amplitude bars.
        ctx.fillRect(x, center - max * laneHeight * 0.46, 1, Math.max(0.25, (max - min) * laneHeight * 0.46));
      }
    });
  }, [peaks, clipDuration, mediaOffset, playbackRate, isReversed, color, height, pixelsPerSecond, visibleStart, visibleWidth]);
  return <canvas ref={canvasRef} aria-label={unavailable ? 'Waveform unavailable for this audio codec' : peaks ? 'Audio waveform' : 'Generating waveform'} className="absolute top-0 pointer-events-none" style={{ left: visibleStart, width: visibleWidth, height }} />;
};
export default React.memo(Waveform);
