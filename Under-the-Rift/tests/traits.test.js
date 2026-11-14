import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {PORTRAIT_CROPS} from '../dist/portrait-crops.js';

test('all existing traits remain available within the three ordinary tiers plus the GOAT designation',()=>{
 const oldCommon='Clutch Playmaker Student Resilient Driven Connector Strategist Duelist Teamfighter Captain Consistent Streaky Tireless Restorative Optimist Perfectionist Mentor Showman Analyst RiskTaker Patient Improviser BigStage PracticeAce Empathetic Methodical Curious Reflective Competitive Disciplined Easygoing Focused Collaborative Composed Mercurial Tenacious Closer FreshMind Encouraging Sensitive'.split(' ');
 for(const t of oldCommon){assert.ok(E.TRAITS[t]);assert.equal(E.traitTier(t),'common');}
 for(const t of ['AnchorMind','QuietGenius','LimitBreaker','SecondWind','IceVeins','KindredSpirit','ScrimDemon','StageSpark','OldSoul','Relentless','PatternReader','TeamFirst']){
  assert.ok(E.TRAITS[t]);assert.equal(E.traitTier(t),'rare');
 }
 for(const t of ['OneMoreBubble','StarCartographer']){assert.ok(E.TRAITS[t]);assert.equal(E.traitTier(t),'generational');}
 for(const t of ['Jhinaholic','FioraMain']){assert.ok(E.TRAITS[t]);assert.equal(E.traitTier(t),'goat');}
 const all=[...E.COMMON_TRAITS,...E.RARE_TRAITS,...E.GENERATIONAL_TRAITS,...E.GOAT_TRAITS];
 assert.equal(new Set(all).size,all.length);assert.equal(all.length,Object.keys(E.TRAITS).length);
 assert.deepEqual(Object.keys(E.TRAIT_TIERS),['common','rare','generational','goat']);
 assert.ok(E.COMMON_TRAITS.length>=52);assert.ok(E.RARE_TRAITS.length>=22);assert.ok(E.GENERATIONAL_TRAITS.length>=10);
});

test('rarity odds apply per player: approximately one in five rare, 4.5% generational',()=>{
 const s={seed:92381},copy={seed:s.seed},count=15000;
 let rare=0,generational=0,both=0;
 for(let i=0;i<count;i++){
  const traits=E.rollPlayerTraits(s);assert.deepEqual(traits,E.rollPlayerTraits(copy));
  assert.equal(traits.filter(t=>E.traitTier(t)==='common').length,2);assert.equal(new Set(traits).size,traits.length);
  assert.ok(traits.every(t=>!E.SPECIAL_TRAITS.includes(t)));
  const hasRare=traits.some(t=>E.traitTier(t)==='rare'),hasGen=traits.some(t=>E.traitTier(t)==='generational');
  rare+=hasRare;generational+=hasGen;both+=hasRare&&hasGen;
 }
 assert.ok(rare/count>.18&&rare/count<.22,`Rare rate: ${rare/count}`);
 assert.ok(generational/count>.037&&generational/count<.053,`Generational rate: ${generational/count}`);
 assert.ok(both>80&&both<320,'Independent rolls allow both tiers on the same player');
});

test('new player generation uses all three tiers and preserves traits through migration and reload',()=>{
 const s=E.newGame(109),ordinary=s.players.filter(p=>!p.secretProspect);
 for(const tier of ['rare','generational'])assert.ok(ordinary.some(p=>p.traits.some(t=>E.traitTier(t)===tier)));
 const before=s.players.map(p=>[p.id,[...p.traits]]),seed=s.seed;
 s.version=3;E.validateSave(s);assert.deepEqual(s.players.map(p=>[p.id,p.traits]),before);assert.equal(s.seed,seed);
 assert.deepEqual(E.validateSave(structuredClone(s)).players.map(p=>p.traits),s.players.map(p=>p.traits));
});

test('new common, rare and generational traits affect real training, skills and recovery',()=>{
 const base=E.newGame(37);
 for(const [name,focus] of [['Coachable','Communication'],['RapidAdapter','Balanced'],['MechanicalProdigy','Mechanics']]){
  const a=structuredClone(base),b=structuredClone(base),p=E.starters(a)[0],q=E.starters(b)[0];
  p.traits=[];q.traits=[name];p.focus=q.focus=focus;p.intensity=q.intensity='Normal';p.fatigue=q.fatigue=10;
  const before=E.SKILLS.reduce((sum,k)=>sum+p.skills[k],0);E.training(a);E.training(b);
  assert.ok(E.SKILLS.reduce((sum,k)=>sum+q.skills[k],0)-before>E.SKILLS.reduce((sum,k)=>sum+p.skills[k],0)-before,name);
 }
 const p=E.starters(base)[0];p.traits=['Omniscient'];p.skills=Object.fromEntries(E.SKILLS.map(k=>[k,50]));
 assert.equal(E.effectiveSkill(p,'Macro'),56);assert.equal(E.effectiveSkill(p,'Communication'),53);
 const a=structuredClone(base),b=structuredClone(base),pa=E.starters(a)[0],pb=E.starters(b)[0];
 pa.traits=[];pb.traits=['EndlessDrive'];pa.focus=pb.focus='Mechanics';pa.intensity=pb.intensity='Intense';pa.fatigue=pb.fatigue=10;
 E.training(a);E.training(b);assert.ok(pb.skills.Mechanics>pa.skills.Mechanics);assert.ok(pb.fatigue<pa.fatigue);
});

test('player-facing trait badges expose Common, Rare and Generational labels',()=>{
 let source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const start=source.indexOf('const careerDB='),end=source.indexOf('function toast(');
 source=source.slice(0,start)+'let started=true;\n'+source.slice(end);
 source=source.slice(0,source.indexOf("document.addEventListener('click'"));
 const context=vm.createContext({E,PORTRAIT_CROPS,document:{addEventListener(){},querySelector(){return {};}}});
 vm.runInContext(source+'\nglobalThis.badge=trait;',context);
 for(const [name,tier] of [['Student','Common'],['PhoenixMind','Rare'],['FinalBoss','Generational'],['FioraMain','GOAT']]){
  const html=context.badge(name);assert.ok(html.includes(tier));assert.ok(html.includes(tier.toLowerCase()+'trait'));assert.ok(html.includes(E.TRAITS[name]));
 }
});
