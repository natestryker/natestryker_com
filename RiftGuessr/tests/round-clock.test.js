import test from 'node:test';
import assert from 'node:assert/strict';
import {RoundClock} from '../round-clock.js';
import {DIFFICULTIES} from '../core.js';

function setup(){
 let time=1000,id=0,expired=0;
 const jobs=new Map(),ticks=[];
 const clock=new RoundClock({now:()=>time,schedule:(callback,delay)=>{jobs.set(++id,{callback,at:time+delay});return id;},cancel:id=>jobs.delete(id),onTick:seconds=>ticks.push(seconds),onExpire:()=>expired++});
 function advance(ms){
  const end=time+ms;
  while(jobs.size){
   const [key,next]=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(next.at>end)break;
   jobs.delete(key);time=next.at;next.callback();
  }
  time=end;
 }
 return {clock,ticks,jobs,advance,jump:ms=>{time+=ms;},expired:()=>expired};
}

test('Easy, Normal and Hard have exactly the requested per-round time limits',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(DIFFICULTIES).map(([key,mode])=>[key,mode.timeLimit])),{easy:20,normal:13,hard:8});
});
test('each clock runs for its full limit and expires exactly once',()=>{
 for(const mode of Object.values(DIFFICULTIES)){
  const h=setup();h.clock.start(mode.timeLimit);assert.deepEqual(h.ticks,[mode.timeLimit]);
  h.advance(mode.timeLimit*1000-1);assert.equal(h.expired(),0);assert.equal(h.clock.running,true);
  h.advance(1);assert.equal(h.expired(),1);assert.equal(h.clock.running,false);assert.equal(h.ticks.at(-1),0);assert.equal(h.jobs.size,0);
  h.advance(60000);assert.equal(h.expired(),1);
 }
});
test('display updates whole seconds once rather than announcing every scheduler tick',()=>{
 const h=setup();h.clock.start(8);h.advance(3000);assert.deepEqual(h.ticks,[8,7,6,5]);
 h.advance(5000);assert.deepEqual(h.ticks,[8,7,6,5,4,3,2,1,0]);
});
test('a delayed callback cannot extend the round or accept an input beyond the deadline',()=>{
 const h=setup();h.clock.start(13);h.jump(13000);
 assert.equal(h.clock.check(),true);assert.equal(h.expired(),1);assert.equal(h.jobs.size,0);
 assert.equal(h.clock.check(),false);h.advance(1000);assert.equal(h.expired(),1);
});
test('manual stop and leaving a round cancel all future expiry work',()=>{
 const h=setup();h.clock.start(8);h.advance(2200);h.clock.stop();
 const ticks=[...h.ticks];h.advance(60000);assert.deepEqual(h.ticks,ticks);assert.equal(h.expired(),0);assert.equal(h.jobs.size,0);
});
test('a callback already queued from the previous round cannot alter a fresh timer',()=>{
 const h=setup();h.clock.start(8);const stale=[...h.jobs.values()][0].callback;
 h.clock.stop();h.clock.start(20);stale();
 assert.equal(h.jobs.size,1);assert.equal(h.ticks.at(-1),20);assert.equal(h.expired(),0);
 h.advance(20000);assert.equal(h.expired(),1);
});
test('returning from a background tab resynchronizes remaining time and expires overdue rounds',()=>{
 const h=setup();h.clock.start(13);h.jump(5500);h.clock.refresh();
 assert.equal(h.ticks.at(-1),8);assert.equal(h.jobs.size,1);assert.equal(h.expired(),0);
 h.jump(7500);h.clock.refresh();assert.equal(h.ticks.at(-1),0);assert.equal(h.expired(),1);assert.equal(h.jobs.size,0);
});
test('invalid limits are rejected without starting a clock',()=>{
 const h=setup();for(const value of [0,-1,NaN,Infinity])assert.throws(()=>h.clock.start(value));
 assert.equal(h.clock.running,false);assert.equal(h.jobs.size,0);
});
