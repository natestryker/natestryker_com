import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {FOG_SCENARIOS,FOG_REGIONS,FOG_OBSERVE_MS,FOG_ANSWER_MS,fogChoices,fogScenario,fogPosition} from '../dist/fog-tracking-data.js';
import {fogMap} from '../dist/fog-tracking.js';

function state(type,extra={}){
 return {match:{current:{skillCheck:{type,kind:'control',status:'ready',mechanics:50,target:.5,duration:1000,scenario:0,variant:0,replacement:true,...extra}}}};
}
function score(type,value,extra={}){
 const s=state(type,extra);
 E.startSkillCheck(s);
 E.finishSkillCheck(s,value);
 return s.match.current.skillCheck;
}

// Controlled clock and minimal dialog nodes exercise the real event handlers.
function mount(type,extra={},random=0){
 let now=100,id=0;
 const pending=new Map(),listeners=new Map();
 class Node{
  constructor(){this.nodes=new Map();this.style={};this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};}
  set innerHTML(value){this.html=value;this.nodes.clear();}
  get innerHTML(){return this.html;}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Node());return this.nodes.get(selector);}
  querySelectorAll(selector){
   if(selector!=='[data-fog-answer]')throw Error('Unexpected selector '+selector);
   return [...this.html.matchAll(/data-fog-answer="([^"]+)"/g)].map(([,key])=>{
    const button=this.querySelector('[data-fog-answer="'+key+'"]');button.dataset={fogAnswer:key};return button;
   });
  }
  focus(){this.focused=true;}
  scrollIntoView(){this.scrolled=true;}
 }
 const dialog=new Node();
 dialog.addEventListener=(name,fn)=>listeners.set(name,fn);
 dialog.removeEventListener=name=>listeners.delete(name);
 dialog.showModal=()=>{dialog.open=true;};
 dialog.close=()=>{dialog.open=false;listeners.get('close')?.();};
 const schedule=(fn,delay)=>{pending.set(++id,{fn,time:now+delay});return id;};
 const math=Object.create(Math);math.random=()=>random;
 const context=vm.createContext({Math:math,performance:{now:()=>now},setTimeout:schedule,clearTimeout:id=>pending.delete(id),requestAnimationFrame:fn=>schedule(fn,16),cancelAnimationFrame:id=>pending.delete(id)});
 const source=['fog-tracking-data.js','fog-tracking.js','skill-checks.js'].map(file=>readFileSync(new URL('../dist/'+file,import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'')).join('\n');
 vm.runInContext(source+'\nglobalThis.mount=mountSkillCheck;',context);
 const s=state(type,extra),c=s.match.current.skillCheck;
 context.mount(s,{...E,callPreview:()=>({player:{name:'Test player'},call:['JGL','Test call'],up:3,down:2})},dialog,{save(){},resolve(){}});
 const stage=()=>dialog.querySelector('#check-stage');
 function advance(ms){
  const end=now+ms;
  while(pending.size){
   const [key,next]=[...pending].sort((a,b)=>a[1].time-b[1].time)[0];
   if(next.time>end)break;
   pending.delete(key);now=next.time;next.fn();
  }
  now=end;
 }
 return {s,c,dialog,stage,pending,advance,start:()=>stage().querySelector('#check-start').onclick(),hit:()=>stage().querySelector('button')};
}

test('timing requires the narrowed target and still rewards Mechanics',()=>{
 for(const target of [.3,.5,.7]){
  assert.equal(score('timing',target,{target}).bonus,.06);
  assert.equal(score('timing',target+.06,{target,mechanics:100}).bonus,-.03);
 }
 assert.equal(score('timing',.54,{mechanics:1}).bonus,-.03);
 assert.equal(score('timing',.54,{mechanics:100}).bonus,.06);
 assert.equal(score('timing',NaN).bonus,-.03);
});

test('timing display and scoring agree in both directions across unlimited bounces',()=>{
 for(const reverse of [false,true]){
  const h=mount('timing',{reverse});h.start();
  assert.match(h.stage().innerHTML,/width:8.5%/);
  h.advance(500);h.hit().onclick();
  assert.equal(h.c.bonus,.06);
  assert.equal(h.pending.size,0);
 }
 const miss=mount('timing');miss.start();miss.advance(400);miss.hit().onclick();
 assert.equal(miss.c.bonus,-.03);
 for(const reverse of [false,true]){
  for(const elapsed of [1500,2500,10500]){
   const h=mount('timing',{reverse});h.start();h.advance(elapsed);
   assert.equal(h.c.status,'attempted');assert.equal(h.pending.size,1);
   const displayed=Number.parseFloat(h.stage().querySelector('#timing-marker').style.left);
   assert.ok(Math.abs(displayed-50)<2);
   h.hit().onkeydown({code:'Space',repeat:false,preventDefault(){}});
   assert.equal(h.c.bonus,.06);assert.equal(h.pending.size,0);
  }
 }
 const edge=mount('timing');edge.start();edge.advance(1000);edge.hit().onclick();assert.equal(edge.c.bonus,-.03);
 const closed=mount('timing');closed.start();closed.advance(10000);closed.dialog.close();assert.equal(closed.pending.size,0);assert.equal(closed.c.bonus,-.03);
});

test('reaction keeps its ability-based boundaries and explains misses',()=>{
 assert.equal(score('reaction',80).bonus,.06);
 assert.equal(score('reaction',380).bonus,.06);
 assert.equal(score('reaction',381).bonus,-.03);
 assert.equal(score('reaction',79).bonus,-.03);
 assert.match(score('reaction',250).feedback,/250 ms/);
 assert.match(score('reaction',-1).feedback,/before the GO cue/);
 assert.match(score('reaction',NaN).feedback,/No response/);
});

test('reaction uses a green GO cue and reports keyboard response time',()=>{
 const h=mount('reaction');h.start();
 const key=repeat=>h.hit().onkeydown({code:'Space',repeat,preventDefault(){}});
 key(true);assert.equal(h.c.status,'attempted');
 h.advance(850);assert.ok(h.hit().classes.has('ready'));
 assert.match(h.hit().textContent,/GO/);
 h.advance(250);key(false);
 assert.equal(h.c.bonus,.06);
 assert.match(h.stage().innerHTML,/Response: 250 ms/);
 assert.equal(h.pending.size,0);
});

test('reaction HOLD is distinct, early presses fail, and timeout ends at the allowance',()=>{
 const h=mount('reaction',{variant:2});h.start();h.advance(850);
 assert.ok(h.hit().classes.has('feint'));
 assert.ok(!h.hit().classes.has('ready'));
 h.hit().onclick();assert.equal(h.c.bonus,-.03);
 h.advance(5000);assert.equal(h.pending.size,0);
 const timeout=mount('reaction');timeout.start();timeout.advance(850+380+1);
 assert.equal(timeout.c.status,'complete');
 assert.equal(timeout.c.bonus,-.03);
 assert.match(timeout.c.feedback,/No response/);
});

test('two feints return to WAIT before GO; closing an attempt cancels timers',()=>{
 const h=mount('reaction',{variant:3},.5);h.start();
 h.advance(1600);assert.ok(h.hit().classes.has('feint'));
 h.advance(375);assert.match(h.hit().textContent,/WAIT/);
 h.advance(850);assert.ok(h.hit().classes.has('feint'));
 h.advance(375+850);assert.ok(h.hit().classes.has('ready'));
 h.advance(200);h.hit().onclick();assert.equal(h.c.bonus,.06);
 const interrupted=mount('reaction');interrupted.start();interrupted.dialog.close();
 assert.equal(interrupted.c.bonus,-.03);
 assert.equal(interrupted.pending.size,0);
});

test('every fog route has one clear destination and all answer positions rotate',()=>{
 assert.equal(FOG_SCENARIOS.length,12);
 for(let scenario=0;scenario<FOG_SCENARIOS.length;scenario++){
  const q=FOG_SCENARIOS[scenario],end=q.path.at(-1),previous=q.path.at(-2),target=FOG_REGIONS[q.target].point;
  assert.equal(new Set(q.choices).size,4);assert.ok(q.choices.includes(q.target));
  const direction=end.map((v,i)=>v-previous[i]),heading=target.map((v,i)=>v-end[i]);
  const angle=(direction[0]*heading[0]+direction[1]*heading[1])/(Math.hypot(...direction)*Math.hypot(...heading));
  assert.ok(angle>.94,'Last heading must point toward '+q.target+' in route '+scenario);
  const positions=new Set();
  for(let variant=0;variant<4;variant++){
   const c={scenario,variant};positions.add(fogChoices(c).indexOf(q.target));
   assert.equal(score('fog',q.target,c).bonus,.06);
   assert.equal(score('fog',q.choices.find(x=>x!==q.target),c).bonus,-.03);
  }
  assert.equal(positions.size,4);
  assert.deepEqual(fogPosition(q.path,0),q.path[0]);
  assert.deepEqual(fogPosition(q.path,1),q.path.at(-1));
 }
 assert.equal(score('fog',true).bonus,-.03);
 assert.equal(score('fog','not-a-destination').bonus,-.03);
});

test('fog hides markers and trails during vision gaps, and only reveals the route afterward',()=>{
 const c=state('fog').match.current.skillCheck;
 assert.match(fogMap(c,{elapsed:500}),/class="fog-jungler"/);
 for(const elapsed of [1400,3500]){
  assert.doesNotMatch(fogMap(c,{elapsed}),/class="fog-jungler"|class="fog-trail"|class="fog-route"/);
 }
 const question=fogMap(c,{choices:fogChoices(c)});
 assert.doesNotMatch(question,/fog-correct|fog-wrong|class="fog-jungler"|class="fog-route"/);
 assert.match(fogMap(c,{reveal:true}),/class="fog-route"/);
});

test('fog has a timed observation, accepts one destination, and reveals the scored route',()=>{
 const h=mount('fog');h.start();
 assert.match(h.stage().innerHTML,/Keep your eyes on J/);
 assert.equal(h.stage().querySelector('#fog-map-host').focused,true);
 assert.equal(h.stage().querySelector('#fog-map-host').scrolled,true);
 h.advance(1400);
 assert.doesNotMatch(h.stage().querySelector('#fog-map-host').innerHTML,/class="fog-jungler"/);
 h.advance(500);
 assert.match(h.stage().querySelector('#fog-map-host').innerHTML,/class="fog-jungler"/);
 h.advance(FOG_OBSERVE_MS-1900);
 assert.match(h.stage().innerHTML,/Where was J heading/);
 const buttons=h.stage().querySelectorAll('[data-fog-answer]');
 assert.equal(buttons.length,4);
 buttons.find(b=>b.dataset.fogAnswer===fogScenario(h.c).target).onclick();
 assert.equal(h.c.bonus,.06);assert.equal(h.pending.size,0);
 assert.match(h.stage().innerHTML,/Correct read|fog-route/);
 buttons.find(b=>b.dataset.fogAnswer!==fogScenario(h.c).target).onclick();
 assert.equal(h.c.bonus,.06);
});

test('fog timeout, closing either phase, and reloading an attempt are misses with no live timers',()=>{
 const timeout=mount('fog');timeout.start();timeout.advance(FOG_OBSERVE_MS+FOG_ANSWER_MS);
 assert.equal(timeout.c.bonus,-.03);assert.match(timeout.c.feedback,/in time/);assert.equal(timeout.pending.size,0);
 for(const elapsed of [1000,FOG_OBSERVE_MS+1000]){
  const h=mount('fog');h.start();h.advance(elapsed);h.dialog.close();
  assert.equal(h.c.bonus,-.03);assert.match(h.c.feedback,/interrupted/);assert.equal(h.pending.size,0);
  h.advance(20000);assert.equal(h.c.bonus,-.03);
 }
 const resumed=mount('fog',{status:'attempted'});
 assert.equal(resumed.c.bonus,-.03);assert.match(resumed.stage().innerHTML,/fog-route/);assert.equal(resumed.pending.size,0);
});

test('fog can be trusted before starting, or closed and reopened without an attempt',()=>{
 const h=mount('fog');h.stage().querySelector('#check-trust').onclick();
 assert.equal(h.c.status,'ready');assert.equal(h.c.bonus,undefined);assert.equal(h.pending.size,0);
 const ready=mount('fog');ready.dialog.close();assert.equal(ready.c.status,'ready');
});
