// Headless browser integration checks; the in-app browser is never used.
// Requires ffmpeg/ffprobe and `npx playwright install chromium`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const directory = await mkdtemp(path.join(tmpdir(), 'motion-labs-media-'));
const fixture = path.join(directory, '13-minute.mp4');
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-v', 'error', ...args], { timeout: 30000 });
const probe = filename => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filename]));
const rms = (pcm, from, to) => {
  let sum = 0;
  for (let i = Math.floor(from * 8000); i < Math.floor(to * 8000); i++) sum += pcm.readFloatLE(i * 4) ** 2;
  return Math.sqrt(sum / Math.floor((to - from) * 8000));
};
ffmpeg('-f','lavfi','-i','testsrc2=size=160x90:rate=2:duration=780', '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=780', '-af',"volume='if(lt(mod(t,4),2),0,0.8)':eval=frame", '-c:v','libx264','-preset','ultrafast','-crf','35','-c:a','aac','-b:a','48k','-shortest','-y',fixture);
const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.addInitScript(() => {
  const NativeAudioContext = window.AudioContext;
  window.__previewContexts = [];
  window.AudioContext = class extends NativeAudioContext {
    constructor(...args) { super(...args); window.__previewContexts.push(this); }
  };
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(baseUrl);
  // Exercise import and waveform processing on a throttled UI thread.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.__maxHeartbeat = 0;
    let last = performance.now();
    window.__heartbeat = setInterval(() => { const now = performance.now(); window.__maxHeartbeat = Math.max(window.__maxHeartbeat, now - last); last = now; }, 100);
  });
  await page.locator('#media-import').setInputFiles(fixture);
  await page.locator('[data-media-asset]').first().waitFor();
  await page.locator('[data-media-asset]').first().dblclick();
  await page.locator('canvas[aria-label="Audio waveform"]').waitFor({ timeout: 30000 });
  const heartbeat = await page.evaluate(() => { clearInterval(window.__heartbeat); return window.__maxHeartbeat; });
  assert.ok(heartbeat < 1500, `UI stalled for ${heartbeat} ms during import`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const preview = page.locator('.preview-stage').locator('..');
  await preview.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForFunction(()=>window.__previewContexts.some(context=>context.state==='running'));
  await preview.getByRole('button',{name:'Pause',exact:true}).click();
  assert.equal(await page.getByText('Your next story starts here' , { exact: true }).count(), 0);
  assert.equal(await page.locator('.header-actions').getByRole('button', { name: 'Save project', exact: true }).count(), 0);
  const picker = page.waitForEvent('filechooser');
  const bin = page.getByLabel('Project media; click empty space to import files');
  const box = await bin.boundingBox();
  await bin.click({ position: { x: box.width / 2, y: box.height - 4 } });
  await picker;
  await page.getByRole('button', { name: 'Fit sequence to timeline', exact: true }).click();
  const before = await page.locator('[aria-label="Timeline zoom"]').inputValue();
  await page.getByRole('button', { name: 'Zoom timeline in', exact: true }).click();
  assert.ok(Number(await page.locator('[aria-label="Timeline zoom"]').inputValue()) > Number(before));
  // Seek into the middle, then zoom; the playhead must stay at its screen position.
  await page.locator('[aria-label="Timeline zoom"]').evaluate(input => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '70'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  const waveformBounds = await page.locator('canvas[aria-label="Audio waveform"]').evaluateAll(canvases => canvases.map(canvas => ({ width: canvas.width, css: canvas.getBoundingClientRect().width })));
  assert.ok(waveformBounds.every(bounds => bounds.width <= 3000), 'Waveform canvas grew with total clip duration');
  assert.ok(await page.locator('.timeline-panel div').count() < 600, 'Offscreen ruler ticks were rendered');
  await page.screenshot({ path: path.join(directory, 'editor.png') });

  // Check the actual export dialog, format persistence, progress and cancellation.
  await page.getByRole('button', { name:'File menu',exact:true }).click();
  await page.getByRole('menuitem', { name:'Export video',exact:true }).click();
  const dialog = page.getByRole('dialog', { name:'Export settings' });
  assert.ok(await dialog.getByText('.mp4', {exact:true}).isVisible());
  await dialog.locator('select').selectOption('video/webm;codecs=vp9,opus');
  await dialog.getByRole('button',{name:'Export Video',exact:true}).click();
  await page.getByRole('progressbar',{name:'Export progress'}).waitFor();
  assert.equal(await dialog.locator('select').inputValue(),'video/webm;codecs=vp9,opus');
  await dialog.getByRole('button',{name:'Cancel export',exact:true}).click();
  await dialog.getByRole('button',{name:'Export Video',exact:true}).waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('progress'));
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();

  // Setup an edit far into the 13-minute source: silence 0–1s, source audio 602–604s at 1–3s.
  await page.evaluate(async () => {
    const { getAssets } = await import('/utils/db.ts');
    const src = URL.createObjectURL((await getAssets())[0].blob);
    const video = { id:'video',name:'trim',type:'VIDEO',trackId:0,startTime:1,duration:2,mediaOffset:602,x:0,y:0,width:100,height:100,rotation:0,zIndex:0,props:{src,isMuted:true} };
    const audio = { ...video,id:'audio',type:'AUDIO',trackId:1,props:{src,volume:1} };
    window.__edit = { elements:[video,audio],tracks:[{id:0,name:'V1',type:'video',isVisible:true,isLocked:false},{id:1,name:'A1',type:'audio',isVisible:true,isLocked:false}],duration:3,aspectRatio:'16:9' };
  });
  const exportFile = async (filename, kind, options, modifications = {}) => {
    // Register before rendering: download events occur after the render promise resolves.
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.evaluate(async ({ filename, kind, options, modifications }) => {
      const { exportProjectVideo, exportProjectAudio } = await import('/utils/exportVideo.ts');
      const request = { ...window.__edit, ...modifications, options: { filename, ...options } };
      if (modifications.shiftToZero) request.elements = request.elements.map(el=>({...el,startTime:0,duration:modifications.duration}));
      const originalDirectory = navigator.storage.getDirectory;
      if (modifications.forceFallback) navigator.storage.getDirectory = async () => { throw new Error('OPFS disabled for test'); };
      try { if (kind === 'video') await exportProjectVideo(request); else await exportProjectAudio(request); }
      finally { navigator.storage.getDirectory = originalDirectory; }
    }, { filename, kind, options, modifications });
    const download = await downloadPromise;
    const output = path.join(directory, download.suggestedFilename());
    await download.saveAs(output);
    assert.equal(await download.failure(), null);
    return output;
  };
  for (const [name, mimeType] of [['trim-mp4','video/mp4'], ['trim-webm','video/webm;codecs=vp9,opus']]) {
    const file = await exportFile(name, 'video', { mimeType, fps:24, presetId:'hd',bitrateMbps:2 });
    const metadata = probe(file);
    assert.ok(metadata.streams.some(stream => stream.codec_type === 'video'));
    assert.ok(metadata.streams.some(stream => stream.codec_type === 'audio'));
    assert.ok(Math.abs(Number(metadata.format.duration) - 3) < 0.12);
    const pcmFile = path.join(directory, `${name}.pcm`);
    ffmpeg('-i',file,'-f','f32le','-ac','1','-ar','8000','-y',pcmFile);
    const pcm = await readFile(pcmFile);
    assert.ok(rms(pcm,0,0.8) < 0.001);
    assert.ok(rms(pcm,1.2,1.8) > 0.03);
    assert.ok(rms(pcm,2.2,2.8) > 0.03);
  }
  const wav = await exportFile('trim-wav','audio',{formatId:'wav',mimeType:'audio/wav',sampleRate:48000,channels:2});
  assert.equal(probe(wav).streams[0].codec_name,'pcm_s16le');
  const fallbackWav = await exportFile('fallback-mono','audio',{formatId:'wav',mimeType:'audio/wav',sampleRate:44100,channels:1},{forceFallback:true});
  const fallbackMetadata = probe(fallbackWav).streams[0];
  assert.equal(fallbackMetadata.sample_rate,'44100'); assert.equal(fallbackMetadata.channels,1);
  const speedAndMute = await page.evaluate(async()=>{
    const {renderTimelineAudio}=await import('/utils/timelineAudio.ts');
    const energy = async (elements, tracks) => {
      const result=[];
      for await (const buffer of renderTimelineAudio(elements, tracks, 3)) {
        const samples=buffer.getChannelData(0);
        const middle=samples.subarray(Math.floor(samples.length*0.2),Math.floor(samples.length*0.8));
        result.push(Math.sqrt(middle.reduce((sum,value)=>sum+value*value,0)/middle.length));
      }
      return result;
    };
    const elements=window.__edit.elements.map(el=>el.type==='AUDIO'?{...el,props:{...el.props,playbackRate:2}}:el);
    return {speed:await energy(elements,window.__edit.tracks),muted:await energy(elements,window.__edit.tracks.map(track=>({...track,isMuted:true})))};
  });
  assert.ok(speedAndMute.speed[0]<0.001 && speedAndMute.speed[1]>0.03 && speedAndMute.speed[2]<0.002,JSON.stringify(speedAndMute));
  assert.ok(speedAndMute.muted.every(value=>value<0.001));
  const m4a = await exportFile('trim-m4a','audio',{formatId:'m4a',mimeType:'audio/mp4',sampleRate:48000,channels:2});
  assert.equal(probe(m4a).streams[0].codec_name,'aac');
  const audioWebm = await exportFile('trim-opus','audio',{formatId:'webm',mimeType:'audio/webm',sampleRate:48000,channels:2});
  assert.equal(probe(audioWebm).streams[0].codec_name,'opus');
  // Maximum resolution with audio, using a short edit to keep this a smoke test.
  const uhd = await exportFile('uhd','video',{mimeType:'video/mp4',fps:24,presetId:'uhd-4k',bitrateMbps:45},{duration:0.25,shiftToZero:true});
  const uhdMetadata = probe(uhd);
  assert.equal(uhdMetadata.streams.find(stream=>stream.codec_type==='video').width,3840);
  assert.ok(uhdMetadata.streams.some(stream=>stream.codec_type==='audio'));
  const uhdPcm = path.join(directory, 'uhd.pcm');
  ffmpeg('-i',uhd,'-f','f32le','-ac','1','-ar','8000','-y',uhdPcm);
  assert.ok(rms(await readFile(uhdPcm),0.1,0.2) > 0.03);
  const canceled = await page.evaluate(async()=>{
    const {exportProjectVideo}=await import('/utils/exportVideo.ts');
    const controller = new AbortController();
    let called = false;
    try {
      await exportProjectVideo({...window.__edit, signal:controller.signal,options:{filename:'canceled',mimeType:'video/mp4',presetId:'hd',fps:24},onProgress:()=>{ called=true; controller.abort(); }});
    } catch(error) { return called && error.name === 'AbortError'; }
    return false;
  });
  assert.equal(canceled,true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ passed:true, fixtureDuration:780, cpuThrottle:4, maxUiHeartbeatMs:Math.round(heartbeat), waveformBounds, formats:['MP4/H.264+AAC','WebM/VP9+Opus','WAV','M4A','WebM audio'], checked:['trim offsets','audio silence and sound','duration','2x audio speed','muted tracks','44.1kHz mono/Blob fallback','4K','cancellation','bounded waveform/ruler','blank-bin import','zoom'], artifacts:directory },null,2));
} finally {
  await context.close(); await browser.close(); await server.close();
  if (!process.env.KEEP_MEDIA_TEST_ARTIFACTS) await rm(directory,{recursive:true,force:true});
}
