import test from 'node:test';
import assert from 'node:assert/strict';
import {CountdownAudio} from '../countdown-audio.js';

function setup(state='running'){
 const tones=[],volumes=[];
 const parameter=()=>({events:[],setValueAtTime(value,time){this.events.push({value,time});},linearRampToValueAtTime(value,time){this.events.push({value,time});},exponentialRampToValueAtTime(value,time){this.events.push({value,time});}});
 const context={state,currentTime:12,destination:{},resumes:0,
  resume(){this.resumes++;this.state='running';return Promise.resolve();},
  createOscillator(){const tone={frequency:parameter(),stops:[],connect(node){this.output=node;},disconnect(){this.disconnected=true;},start(time){this.started=time;},stop(time){this.stops.push(time);}};tones.push(tone);return tone;},
  createGain(){const volume={gain:parameter(),connect(node){this.output=node;},disconnect(){this.disconnected=true;}};volumes.push(volume);return volume;}
 };
 let created=0;
 const audio=new CountdownAudio({createContext:()=>{created++;return context;}});
 return {audio,context,tones,volumes,created:()=>created};
}

test('audio is created and resumed by user activation, then reused across games',()=>{
 const h=setup('suspended');assert.equal(h.created(),0);
 h.audio.unlock();assert.equal(h.created(),1);assert.equal(h.context.resumes,1);
 h.audio.unlock();assert.equal(h.created(),1);assert.equal(h.context.resumes,1);
 h.context.state='suspended';h.audio.unlock();assert.equal(h.context.resumes,2);
 h.context.state='closed';h.audio.unlock();assert.equal(h.created(),2);
});

test('the warning is a short ascending chime with a soft volume envelope and automatic cleanup',()=>{
 const h=setup();h.audio.unlock();h.audio.play();
 assert.equal(h.tones.length,1);const tone=h.tones[0],volume=h.volumes[0];
 assert.equal(tone.output,volume);assert.equal(volume.output,h.context.destination);
 assert.equal(tone.started,h.context.currentTime);
 assert.ok(tone.stops[0]>tone.started&&tone.stops[0]<=tone.started+.5);
 const notes=tone.frequency.events;assert.equal(notes.length,2);
 assert.ok(notes[1].value>notes[0].value);assert.ok(notes[1].time>notes[0].time);
 const envelope=volume.gain.events;assert.equal(envelope[0].value,0);assert.equal(envelope.at(-1).value,0);
 assert.ok(Math.max(...envelope.map(e=>e.value))<=.15);
 tone.onended();assert.equal(h.audio.active,null);assert.ok(tone.disconnected&&volume.disconnected);
});

test('stopping or replacing a warning cancels the old tone and disconnects its audio nodes',()=>{
 const h=setup();h.audio.unlock();h.audio.play();const old=h.tones[0];
 h.audio.play();assert.equal(h.tones.length,2);assert.equal(old.onended,null);assert.ok(old.disconnected);
 h.audio.stop();assert.equal(h.audio.active,null);assert.ok(h.tones[1].disconnected&&h.volumes[1].disconnected);
 assert.equal(h.tones[1].stops.at(-1),undefined);assert.doesNotThrow(()=>h.audio.stop());
});

test('unavailable or suspended audio never queues a stale warning',()=>{
 const unavailable=new CountdownAudio({createContext:()=>null});
 assert.doesNotThrow(()=>{unavailable.unlock();unavailable.play();unavailable.stop();});
 const h=setup();h.audio.play();assert.equal(h.tones.length,0);
 h.audio.unlock();h.context.state='suspended';h.audio.play();assert.equal(h.tones.length,0);
 h.context.state='running';assert.equal(h.tones.length,0);
 h.audio.play();assert.equal(h.tones.length,1);
});

test('audio activation and device failures do not interrupt the game',async()=>{
 const blocked=new CountdownAudio({createContext:()=>{throw Error('Audio unavailable');}});
 assert.doesNotThrow(()=>{blocked.unlock();blocked.play();});
 const h=setup('suspended');h.context.resume=()=>Promise.reject(Error('Autoplay denied'));
 h.audio.unlock();await new Promise(resolve=>setImmediate(resolve));h.audio.play();assert.equal(h.tones.length,0);
 h.context.state='running';h.context.createOscillator=()=>{throw Error('Device unavailable');};
 assert.doesNotThrow(()=>h.audio.play());assert.equal(h.audio.active,null);
});
