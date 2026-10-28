import assert from 'node:assert/strict';
import {readAudioPreference, createOceanAudio} from './dist/ambient-audio.mjs';
const storage = value => ({getItem: () => value});
assert.deepEqual(readAudioPreference(storage(null)), {enabled:true,volume:.18});
assert.deepEqual(readAudioPreference(storage('{bad')), {enabled:true,volume:.18});
assert.deepEqual(readAudioPreference(storage('{"enabled":false,"volume":0.4}')), {enabled:false,volume:.4});
assert.deepEqual(readAudioPreference(storage('{"enabled":true,"volume":5}')), {enabled:true,volume:1});
assert.deepEqual(readAudioPreference(undefined), {enabled:true,volume:.18});
let instance, nextId=0; const timers = new Map(), values=[];
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(v){values.push(v);}});
class SoundNode {
  constructor(){this.gain=param();this.frequency=param();this.pan=param();}
  connect(n){return n;} disconnect(){} start(){} stop(){}
}
class Context {
  constructor(){instance=this;this.state='suspended';this.sampleRate=100;this.currentTime=0;this.destination={};this.resumes=0;}
  createGain(){return new SoundNode();} createBiquadFilter(){return new SoundNode();}
  createOscillator(){return new SoundNode();} createBufferSource(){return new SoundNode();} createStereoPanner(){return new SoundNode();}
  createBuffer(c,n){const data=new Float32Array(n);return {getChannelData:()=>data};}
  async resume(){this.resumes++;this.state='running';} async suspend(){this.state='suspended';} async close(){this.state='closed';}
}
const engine = createOceanAudio(Context,{random:()=>.5,schedule:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id)});
engine.setVolume(.18);assert.equal(await engine.start(),true);assert.equal(engine.state,'running');
assert.equal(values.at(-1),.18);assert.equal(timers.size,1);assert.equal([...timers.values()][0].ms,9500);
const [id,first] = [...timers][0];timers.delete(id);first.fn();assert.equal(timers.size,1);assert.equal([...timers.values()][0].ms,33000);
engine.setVolume(5);assert.equal(values.at(-1),1);
engine.pause();assert.equal(timers.size,1);assert.equal([...timers.values()][0].ms,100);[...timers.values()][0].fn();timers.clear();assert.equal(engine.state,'suspended');
const old=engine.start();engine.pause();assert.equal(await old,false);assert.equal(timers.size,1);
await engine.start();assert.equal(timers.size,1);assert.equal(engine.state,'running');
engine.dispose();assert.equal(timers.size,0);assert.equal(engine.state,'closed');assert.equal(await engine.start(),false);
console.log('Ocean ambience: default-on preferences, volume limits, scheduling, pause/resume races and cleanup passed.');
