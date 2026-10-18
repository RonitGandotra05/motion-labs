import { ALL_FORMATS, AudioBufferSink, Input, UrlSource, type WrappedAudioBuffer } from 'mediabunny';
import { ElementType, type EditorElement, type Track } from '../types';
import { audioGainAt, sourceTimeAt } from './mediaTiming';

// Only the current decoding packet and a one-second mix are retained per active clip.
export async function* renderTimelineAudio(elements: EditorElement[], tracks: Track[], duration: number, sampleRate = 48000, channels = 2) {
  const clips = elements.filter(clip => (clip.type === ElementType.AUDIO || clip.type === ElementType.VIDEO) &&
    clip.props.src && !clip.props.isMuted && !tracks.find(track => track.id === clip.trackId)?.isMuted);
  const cursors = new Map<string, {
    input: Input; sink: AudioBufferSink; iterator?: AsyncGenerator<WrappedAudioBuffer>; packet?: WrappedAudioBuffer; done?: boolean;
  }>();
  const finished = new Set<string>();
  try {
    for (let startFrame = 0; startFrame < Math.ceil(duration * sampleRate); startFrame += sampleRate) {
      const count = Math.min(sampleRate, Math.ceil(duration * sampleRate) - startFrame);
      const start = startFrame / sampleRate;
      const end = (startFrame + count) / sampleRate;
      const context = new OfflineAudioContext(channels, count, sampleRate);
      for (const clip of clips) {
        if (clip.startTime >= end || clip.startTime + clip.duration <= start || finished.has(clip.id)) continue;
        let cursor = cursors.get(clip.id);
        if (!cursor) {
          const input = new Input({ source: new UrlSource(clip.props.src!, { maxCacheSize: 4 * 1024 * 1024, getRetryDelay: attempts => attempts < 2 ? 0.25 : null }), formats: ALL_FORMATS });
          try {
            const track = await input.getPrimaryAudioTrack();
            if (!track) { input.dispose(); finished.add(clip.id); continue; }
            if (!await track.canDecode()) throw new Error(`Cannot decode audio for “${clip.name}” in this browser.`);
            cursor = { input, sink: new AudioBufferSink(track) };
            cursors.set(clip.id, cursor);
          } catch (error) { input.dispose(); throw error; }
        }
        const rate = clip.props.playbackRate ?? 1;
        const from = Math.max(start, clip.startTime);
        const to = Math.min(end, clip.startTime + clip.duration);
        const sourceStart = sourceTimeAt(clip, clip.props.isReversed ? to : from);
        const sourceEnd = sourceTimeAt(clip, clip.props.isReversed ? from : to);
        if (clip.props.isReversed && cursor.iterator) {
          await cursor.iterator.return(undefined); cursor.iterator = undefined; cursor.packet = undefined; cursor.done = false;
        }
        cursor.iterator ??= cursor.sink.buffers(sourceStart, clip.mediaOffset + clip.duration * rate);
        const gain = context.createGain();
        // Sample the envelope at packet-independent positions so fades and ducking follow edits.
        for (let t = from; t < to; t += 1 / 100) gain.gain.linearRampToValueAtTime(audioGainAt(clip, elements, tracks, t), t - start);
        gain.gain.linearRampToValueAtTime(audioGainAt(clip, elements, tracks, Math.max(from, to - 1 / sampleRate)), to - start);
        let tail: AudioNode = gain;
        if (clip.props.highPassFrequency) {
          const filter = context.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = clip.props.highPassFrequency;
          tail.connect(filter); tail = filter;
        }
        if (clip.props.lowPassFrequency && clip.props.lowPassFrequency < 20000) {
          const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = clip.props.lowPassFrequency;
          tail.connect(filter); tail = filter;
        }
        const pan = tracks.find(track => track.id === clip.trackId)?.pan;
        if (pan) { const panner = context.createStereoPanner(); panner.pan.value = pan; tail.connect(panner); tail = panner; }
        tail.connect(context.destination);
        while (!cursor.done) {
          if (!cursor.packet) {
            const next = await cursor.iterator.next();
            if (next.done) { cursor.done = true; break; }
            cursor.packet = next.value;
          }
          const packet = cursor.packet;
          const packetEnd = packet.timestamp + packet.buffer.duration;
          if (packet.timestamp >= sourceEnd) break;
          const a = Math.max(sourceStart, packet.timestamp);
          const b = Math.min(sourceEnd, packetEnd);
          if (b > a) {
            const source = context.createBufferSource();
            let buffer = packet.buffer;
            let offset = a - packet.timestamp;
            if (clip.props.isReversed) {
              buffer = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
              for (let c = 0; c < buffer.numberOfChannels; c++) buffer.getChannelData(c).set(packet.buffer.getChannelData(c).slice().reverse());
              offset = packetEnd - b;
            }
            source.buffer = buffer; source.playbackRate.value = rate; source.connect(gain);
            const when = clip.props.isReversed ? from - start + (sourceEnd - b) / rate : from - start + (a - sourceStart) / rate;
            source.start(Math.max(0, when), offset, b - a);
          }
          if (packetEnd >= sourceEnd) break;
          cursor.packet = undefined;
        }
        if (clip.startTime + clip.duration <= end) {
          await cursor.iterator?.return(undefined); cursor.input.dispose(); cursors.delete(clip.id); finished.add(clip.id);
        }
      }
      yield await context.startRendering();
    }
  } finally {
    for (const cursor of cursors.values()) { await cursor.iterator?.return(undefined); cursor.input.dispose(); }
  }
}
