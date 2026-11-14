import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {fogScenario,FOG_SCENARIOS} from '../dist/fog-tracking-data.js';

function setup(){
 const s=E.newGame(3492);
 while(!s.draft.complete)E.draftPlayer(s,s.draft.pool.find(id=>E.getPlayer(s,id).team<0));
 E.finishDraft(s);E.enterMatchday(s);
 s.match.current.events=[0];s.match.current.modes=['check'];
 return s;
}

test('all six replacement checks are reachable and a saved fog route never rerolls',()=>{
 const s=setup(),g=s.match.current,counts=Object.fromEntries(E.CHECK_TYPES.map(type=>[type,0]));
 let saved;
 for(let i=0;i<240;i++){
  s.seed=(i*104729+91)>>>0;g.skillCheck=null;
  assert.ok(E.prepareReplacementCheck(s));
  counts[g.skillCheck.type]++;
  if(g.skillCheck.type==='fog')saved=structuredClone(s);
 }
 for(const count of Object.values(counts))assert.ok(count>20&&count<65);
 assert.ok(saved);
 const original=structuredClone(saved.match.current.skillCheck),seed=saved.seed;
 const loaded=E.validateSave(structuredClone(saved));
 assert.ok(E.prepareReplacementCheck(loaded));
 assert.deepEqual(loaded.match.current.skillCheck,original);assert.equal(loaded.seed,seed);
});

test('fog ready, attempted and completed states roundtrip; invalid routes and answers are rejected',()=>{
 const s=setup(),g=s.match.current;
 E.prepareReplacementCheck(s);Object.assign(g.skillCheck,{type:'fog',scenario:2,variant:1});
 for(const status of ['ready','attempted','complete']){
  if(status==='attempted')E.startSkillCheck(s);
  if(status==='complete')E.finishSkillCheck(s,fogScenario(g.skillCheck).target);
  assert.equal(E.validateSave(structuredClone(s)).match.current.skillCheck.status,status);
 }
 for(const changed of [{scenario:FOG_SCENARIOS.length},{scenario:-1},{variant:8},{answer:'unknown'},{answer:'top'},{bonus:-.03}]){
  const bad=structuredClone(s);Object.assign(bad.match.current.skillCheck,changed);
  assert.throws(()=>E.validateSave(bad));
 }
});

test('fog answers directly earn or lose the displayed match points, and trust uses player ability',()=>{
 for(const answer of ['top','mid',null]){
  const s=setup(),g=s.match.current;
  E.prepareReplacementCheck(s);Object.assign(g.skillCheck,{type:'fog',scenario:0,variant:0});
  const preview=E.callPreview(s,'control');
  if(answer){E.startSkillCheck(s);E.finishSkillCheck(s,answer);}
  E.resolveCall(s,'auto');
  const call=s.match.games[0].calls[0];
  if(answer){
   assert.equal(call.worked,answer==='top');
   assert.equal(call.swing,answer==='top'?preview.up:-preview.down);
   assert.equal(call.skillCheck.type,'fog');
  }else{
   assert.equal(call.skillCheck,null);assert.equal(call.chance,preview.chance);
  }
 }
});

test('expanded jungle destinations are generated, scored and saved without changing old routes',()=>{
 const s=setup(),g=s.match.current,seen=new Set();
 for(let i=0;i<800;i++){
  s.seed=(i*104729+91)>>>0;g.skillCheck=null;E.prepareReplacementCheck(s);
  if(g.skillCheck.type==='fog')seen.add(g.skillCheck.scenario);
 }
 assert.ok([...seen].some(n=>n>=12));assert.ok(seen.size>=20);
 for(let scenario=12;scenario<FOG_SCENARIOS.length;scenario++){
  const saved=structuredClone(s);Object.assign(saved.match.current.skillCheck,{type:'fog',status:'ready',scenario,variant:scenario%4});
  const loaded=E.validateSave(saved),c=loaded.match.current.skillCheck;
  assert.equal(c.scenario,scenario);E.startSkillCheck(loaded);E.finishSkillCheck(loaded,fogScenario(c).target);
  const completed=E.validateSave(structuredClone(loaded)).match.current.skillCheck;
  assert.equal(completed.answer,FOG_SCENARIOS[scenario].target);assert.equal(completed.bonus,.06);
 }
 assert.equal(FOG_SCENARIOS[0].target,'top');assert.equal(FOG_SCENARIOS[11].target,'dragon');
});
