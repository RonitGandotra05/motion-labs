export interface WaveformPeaks { duration: number; binsPerSecond: number; levels: Float32Array[][] }
type Listener = (peaks: WaveformPeaks | null) => void;
const cache = new Map<string, WaveformPeaks>();
const pending = new Map<string, Set<Listener>>();
let worker: Worker | undefined;
let active: string | undefined;
let bytes = 0;
const sizeOf = (peaks: WaveformPeaks) => peaks.levels.flat().reduce((sum, array) => sum + array.byteLength, 0);
const next = () => {
  if (active || !pending.size) return;
  active = pending.keys().next().value;
  worker ??= new Worker(new URL('./waveform.worker.ts', import.meta.url), { type: 'module' });
  const finish = (peaks: WaveformPeaks | null) => {
    const url = active!;
    if (peaks) {
      const size = sizeOf(peaks);
      while (bytes + size > 32 * 1024 * 1024 && cache.size) {
        const key = cache.keys().next().value!;
        bytes -= sizeOf(cache.get(key)!); cache.delete(key);
      }
      cache.set(url, peaks); bytes += size;
    }
    pending.get(url)?.forEach(listener => listener(peaks)); pending.delete(url);
    active = undefined; worker?.terminate(); worker = undefined; next();
  };
  worker.onmessage = event => finish(event.data.peaks || null);
  worker.onerror = () => finish(null);
  worker.postMessage({ url: active });
};
export const subscribeWaveform = (url: string, listener: Listener) => {
  const existing = cache.get(url);
  if (existing) { cache.delete(url); cache.set(url, existing); listener(existing); return () => {}; }
  const listeners = pending.get(url) || new Set<Listener>(); listeners.add(listener); pending.set(url, listeners); next();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      pending.delete(url);
      if (active === url) { worker?.terminate(); worker = undefined; active = undefined; }
      next();
    }
  };
};
