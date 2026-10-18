import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timelineEnd, sourceTimeAt, audioGainAt } from '../utils/mediaTiming.ts';
import type { EditorElement, Track } from '../types.ts';
const clip: EditorElement = { id:'audio',type:'AUDIO' as EditorElement['type'],name:'trim',trackId:1,startTime:3,duration:2,mediaOffset:602,x:0,y:0,width:0,height:0,rotation:0,zIndex:0,props:{playbackRate:2} };
const tracks: Track[] = [{ id:1,name:'A1',type:'audio',isVisible:true,isLocked:false,volume:0.5 }];
test('exports end at the last edit and source timing respects offset, speed, reverse, and freeze', () => {
  assert.equal(timelineEnd([clip]),5);
  assert.equal(timelineEnd([]),0);
  assert.equal(sourceTimeAt(clip,4),604);
  assert.equal(sourceTimeAt({...clip,props:{playbackRate:2,isReversed:true}},3.5),605);
  assert.equal(sourceTimeAt({...clip,props:{isFreezeFrame:true}},4),602);
});
test('audio is silent outside edits; volume, fades, mute and solo affect the mix', () => {
  const faded = {...clip,props:{volume:0.8,fadeIn:1,fadeOut:1}};
  assert.equal(audioGainAt(faded,[faded],tracks,2),0);
  assert.equal(audioGainAt(faded,[faded],tracks,3.5),0.2);
  assert.equal(audioGainAt(faded,[faded],tracks,4),0.4);
  assert.equal(audioGainAt(faded,[faded],tracks,4.5),0.2);
  assert.equal(audioGainAt(faded,[faded],tracks,5),0);
  assert.equal(audioGainAt(clip,[clip],[{...tracks[0],isMuted:true}],4),0);
  assert.equal(audioGainAt(clip,[clip],[...tracks,{...tracks[0],id:2,isSoloed:true}],4),0);
});
