import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {PORTRAIT_CROPS} from '../dist/portrait-crops.js';

function ui(s){
 let source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const start=source.indexOf('const careerDB='),end=source.indexOf('function toast(');
 source=source.slice(0,start)+'let started=true;\n'+source.slice(end);source=source.slice(0,source.indexOf("document.addEventListener('click'"));
 const nodes={},document={addEventListener(){},querySelector:q=>nodes[q]??={innerHTML:'',showModal(){},close(){}}};
 const context=vm.createContext({E,PORTRAIT_CROPS,document});
 vm.runInContext(source+'\nglobalThis.ui={set:x=>s=x,pairRow,globalContractDatabase,openProfile};',context);context.ui.set(s);return {api:context.ui,nodes};
}

test('signed players have exact public ability at every scouting level, with traits still concealed',()=>{
 const s=E.newGame(109);while(!s.draft.complete)E.draftPlayer(s,s.draft.pool.find(id=>E.getPlayer(s,id).team<0));
 for(const p of s.players.filter(p=>p.team>=0&&p.team!==s.team)){
  for(const scout of [0,1,2]){
   p.scout=scout;assert.equal(E.scoutingLabel(s,p),String(E.overall(p)));assert.equal(E.scoutEstimate(s,p).exact,true);assert.equal(E.scoutTerms(s,p).range,0);
   for(const skill of E.SKILLS)assert.equal(E.scoutEstimate(s,p,skill).estimate,E.effectiveSkill(p,skill));
  }
 }
 const p=E.starters(s,1)[0];p.scout=0;p.traits=['Student','PhoenixMind','FinalBoss'];
 assert.equal(E.scoutingComplete(s,p),false);assert.deepEqual(E.knownTraits(s,p),['Student']);
 const free=s.players.find(p=>p.team<0);free.scout=0;assert.equal(E.scoutEstimate(s,free).exact,false);assert.match(E.scoutingLabel(s,free),/–/);
 free.scout=2;assert.equal(E.scoutingLabel(s,free),String(E.overall(free)));
});

test('match preview, GCD and profiles show a single true rating for unscouted signed opponents',()=>{
 const s=E.newGame(51),a=E.starters(s)[0],p=E.starters(s,1)[0];p.scout=0;p.traits=['Student','PhoenixMind','FinalBoss'];
 const {api,nodes}=ui(s),row=api.pairRow(a,p,a.niches[0],p.niches[0]);
 const ratings=[...row.matchAll(/class="ovr">([^<]+)</g)].map(m=>m[1]);assert.deepEqual(ratings,[String(E.overall(a)),String(E.overall(p))]);
 const gcd=api.globalContractDatabase().split(`data-gcd-player="${p.id}"`)[1].split('</tr>')[0];assert.ok(gcd.includes(`<b>${E.overall(p)}</b>`));
 api.openProfile(p.id);const profile=nodes['#modal'].innerHTML;assert.ok(profile.includes(`<span class="ovr">${E.overall(p)}</span>`));
 assert.doesNotMatch(profile,/PhoenixMind|FinalBoss|class="skills"|historychart/);assert.match(profile,/rating is public/);
});

test('new careers have a league-wide starting spread of at most 6.5 with real player baselines',()=>{
 const centers=[];
 for(const seed of [0,1,2,3,21,51,109,183,41822,592,104729,4294967295]){
  const s=E.newGame(seed),ratings=s.teams.map(t=>E.teamRating(s,t.id)),spread=Math.max(...ratings)-Math.min(...ratings);
  centers.push((Math.max(...ratings)+Math.min(...ratings))/2);assert.ok(spread<=6.5,`Seed ${seed}: ${spread}`);assert.ok(spread>2,'Clubs should still start with different strengths');
  for(const p of s.players.filter(p=>p.squad==='main')){assert.equal(p.initial,E.overall(p));assert.equal(p.contract.salary,Math.round((p.initial-45)*800/1000)*1000);}
  E.validateSave(structuredClone(s));
 }
 assert.ok(Math.max(...centers)-Math.min(...centers)>10,'Absolute starting strength should vary between careers');
});

test('existing careers and later growth are not constrained by the starting spread',()=>{
 const s=E.newGame(51);for(const p of E.starters(s))for(const skill of E.SKILLS)p.skills[skill]=100;
 for(const p of E.starters(s,1))for(const skill of E.SKILLS)p.skills[skill]=20;
 const before=structuredClone(s.players);assert.ok(E.teamRating(s)-E.teamRating(s,1)>6.5);
 const loaded=E.validateSave(structuredClone(s));assert.deepEqual(loaded.players,before);assert.ok(E.teamRating(loaded)-E.teamRating(loaded,1)>6.5);
 const repeat=E.newGame(109),other=E.newGame(109);assert.deepEqual(repeat,other);
});
