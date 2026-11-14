import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {PORTRAIT_CROPS} from '../dist/portrait-crops.js';

function setup(seed=51){
 const s=E.newGame(seed);
 while(!s.draft.complete)E.draftPlayer(s,s.draft.pool.find(id=>E.getPlayer(s,id).team<0));
 E.finishDraft(s);return s;
}
function ui(s){
 let source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const start=source.indexOf('const careerDB='),end=source.indexOf('function toast(');
 source=source.slice(0,start)+'let started=true;\n'+source.slice(end);
 source=source.slice(0,source.indexOf("document.addEventListener('click'"));
 const context=vm.createContext({E,PORTRAIT_CROPS,document:{addEventListener(){},querySelector(){return {};}}});
 vm.runInContext(source+'\nglobalThis.ui={set:x=>s=x,globalContractDatabase,marketView,tab:x=>marketTab=x};',context);
 context.ui.set(s);return context.ui;
}

test('every region has distinct club strengths and ratings do not follow the manager',()=>{
 const s=setup();
 for(const r of E.regions(s)){
  const ratings=s.teams.filter(t=>t.region===r).map(t=>E.teamRating(s,t.id));
  assert.ok(Math.max(...ratings)-Math.min(...ratings)>15);
 }
 const other=E.teamRating(s,1),players=JSON.stringify(E.starters(s,1));
 for(const p of E.starters(s))for(const k of E.SKILLS)p.skills[k]=100;
 assert.equal(E.teamRating(s,1),other);assert.equal(JSON.stringify(E.starters(s,1)),players);
 const plans=JSON.stringify(s.teams.map(t=>t.development));s.team=2;
 assert.equal(JSON.stringify(s.teams.map(t=>t.development)),plans);
});

test('rivals keep their players while training and matches develop their existing roster',()=>{
 const s=setup(),ids=s.players.filter(p=>p.team>=0&&p.team!==s.team).map(p=>({id:p.id,team:p.team,skills:{...p.skills}}));
 for(let i=0;i<3;i++){
  if(s.clubEvent)E.chooseClubEvent(s,1);
  assert.ok(E.enterMatchday(s));E.fastForward(s);E.finishMatchday(s);
 }
 for(const old of ids){const p=E.getPlayer(s,old.id);assert.equal(p.team,old.team);assert.notDeepEqual(p.skills,old.skills);assert.equal(p.trainingWeeks,3);}
 assert.ok(E.starters(s,1).every(p=>p.games>0));
 const snapshot=E.validateSave(structuredClone(s));assert.deepEqual(snapshot.players,s.players);
 assert.deepEqual(snapshot.teams.map(t=>t.development),s.teams.map(t=>t.development));
});

test('old careers gain club plans without rerolling their rosters, abilities or RNG',()=>{
 const s=setup();for(const t of s.teams)delete t.development;
 const players=structuredClone(s.players),seed=s.seed;
 E.validateSave(s);assert.deepEqual(s.players,players);assert.equal(s.seed,seed);
 assert.equal(new Set(s.teams.map(t=>t.development.approach)).size,3);
 const copy=structuredClone(s);E.training(s);E.training(copy);assert.deepEqual(s,copy);
 s.teams[1].development.focus='Bogus';assert.throws(()=>E.validateSave(s));
});

test('a developed academy player earns a starting place with a full senior bench',()=>{
 const s=setup(),t=s.teams[1],young=E.academy(s,t.id)[0],current=E.getPlayer(s,t.lineup[young.role]);
 for(const k of E.SKILLS){current.skills[k]=25;young.skills[k]=95;}
 while(E.squad(s,t.id).length<7){const p=E.createPlayer(s,'SUP',20,t.id,'main');s.players.push(p);p.contract.role='Rotation';}
 while(E.academy(s,t.id).length<6)s.players.push(E.createPlayer(s,'TOP',20,t.id,'academy'));
 const contract={...current.contract},tenure=structuredClone(young.clubTenure);
 E.aiDevelopLineups(s);
 assert.equal(t.lineup[young.role],young.id);assert.equal(young.squad,'main');assert.equal(current.squad,'academy');
 assert.equal(current.team,t.id);assert.equal(current.contract.end,contract.end);assert.equal(current.contract.salary,contract.salary);
 assert.deepEqual(young.clubTenure,tenure);assert.equal(E.squad(s,t.id).length,7);assert.equal(E.academy(s,t.id).length,6);
 assert.ok(s.market.ledger.some(e=>e.type==='Promotion'&&e.players.includes(young.id)&&e.teams.includes(t.id)));
 E.validateSave(structuredClone(s));
});

test('rival renewals preserve the starting core and produce confirmed contract news',()=>{
 const s=setup(),t=s.teams[1],core=E.clubPlan(s,t.id).core;core.contract.end=s.year;
 t.wageLimit=1000000;s.phase='offseason';E.ensureMeta(s);
 assert.ok(E.openWindow(s).ok);assert.equal(core.team,t.id);assert.ok(core.contract.end>s.year);
 const renewal=s.market.ledger.find(e=>e.type==='Renewal'&&e.players.includes(core.id));
 assert.ok(renewal);assert.deepEqual(renewal.teams,[t.id]);
 s.market.ledger=[renewal];s.market.offers=[];
 assert.ok(E.regionalRumors(s).some(r=>r.team===t.id&&r.label==='Confirmed move'&&r.text.includes(core.name)&&r.text.includes(String(core.contract.end))));
});

test('full senior squads can fund a real upgrade by settling a reserve contract',()=>{
 const s=setup(),t=s.teams[1];s.phase='offseason';E.ensureMeta(s);assert.ok(E.openWindow(s).ok);
 for(const other of s.teams)if(other.id!==s.team)other.funds=0;
 t.funds=2000000;t.wageLimit=1000000;
 for(const p of s.players.filter(p=>p.team===t.id))for(const k of E.SKILLS)p.skills[k]=10;
 while(E.squad(s,t.id).length<7){const p=E.createPlayer(s,'SUP',5,t.id,'main');p.contract.role='Rotation';s.players.push(p);}
 const reserves=E.squad(s,t.id).filter(p=>t.lineup[p.role]!==p.id).map(p=>p.id);
 const target=E.createPlayer(s,'MID',95);target.contract=null;s.players.push(target);
 for(let i=0;i<6;i++)assert.ok(E.advanceWindow(s).ok);
 assert.equal(target.team,t.id);assert.equal(t.lineup.MID,target.id);assert.ok(E.squad(s,t.id).length<=7);
 const released=reserves.map(id=>E.getPlayer(s,id)).find(p=>p.team===-1);
 assert.ok(released);assert.equal(released.contract,null);
 assert.ok(s.market.ledger.some(e=>e.type==='Release'&&e.players.includes(released.id)&&e.teams.includes(t.id)&&e.amount>0));
 assert.ok(t.funds>=0);assert.ok(E.payroll(s,t.id)<=t.wageLimit);E.validateSave(structuredClone(s));
});

test('roster rumors omit stale, ineligible and unaffordable competing offers',()=>{
 const s=setup(),p=s.players.find(p=>p.team<0&&!p.secretProspect),bid={team:1,...E.askingTerms(s,p,1)};
 s.market.offers=[{player:p.id,status:'waiting',expires:s.market.clock+3,rivals:[bid]}];
 const hasInterest=()=>E.regionalRumors(s).some(r=>r.label==='Reported interest'&&r.team===1);
 assert.ok(hasInterest());const before=JSON.stringify(s);hasInterest();assert.equal(JSON.stringify(s),before);
 s.teams[1].funds=0;assert.equal(hasInterest(),false);s.teams[1].funds=1000000;
 s.teams[1].wageLimit=0;assert.equal(hasInterest(),false);s.teams[1].wageLimit=1000000;
 s.market.offers[0].expires=s.market.clock-1;assert.equal(hasInterest(),false);s.market.offers[0].expires=s.market.clock+3;
 s.market.offers[0].status='lost';assert.equal(hasInterest(),false);s.market.offers[0].status='waiting';
 p.team=2;assert.equal(hasInterest(),false);p.team=-1;
 // The club field wins over a name or old club tag in historical prose.
 s.market.offers=[];s.market.ledger=[{year:2026,type:'Transfer',teams:[2],text:'FLY sign a player named C9.',players:[p.id]}];
 assert.ok(E.regionalRumors(s).some(r=>r.team===2&&r.label==='Confirmed move'));
 assert.ok(!E.regionalRumors(s).some(r=>r.team===0));
 s.market.ledger=[
  {year:2026,type:'Expiry',teams:[2],text:'FLY release Example.',players:[p.id]},
  {year:2026,type:'Signing',teams:[1],text:'SEN sign Example.',players:[p.id]}
 ];
 const news=E.regionalRumors(s).filter(r=>r.label==='Confirmed move');
 assert.ok(news.some(r=>r.text.includes('release Example')));assert.ok(news.every(r=>!r.text.includes('sign Example')));
});

test('GCD includes every signed player, exact scores, salaries, expiry and club plans',()=>{
 const s=setup(),screen=ui(s),before=JSON.stringify(s),html=screen.globalContractDatabase();
 assert.match(html,/GCD \(Global Contract Database\)/);assert.equal((html.match(/data-gcd-team=/g)||[]).length,s.teams.length);
 const signed=s.players.filter(p=>p.team>=0);assert.equal((html.match(/data-gcd-player=/g)||[]).length,signed.length);
 for(const p of signed){
  const row=html.split(`data-gcd-player="${p.id}"`)[1].split('</tr>')[0];
  assert.ok(row.includes('$'+p.contract.salary.toLocaleString('en-US')+'/yr'));
  assert.ok(row.includes(String(p.contract.end)));assert.ok(row.includes(`<b>${E.overall(p)}</b>`));
 }
 assert.equal(JSON.stringify(s),before);screen.tab('gcd');assert.match(screen.marketView(),/Global Contract Database/);
 const p=signed[0];p.name='<img onerror="oops">';p.contract.end=s.year;s.phase='offseason';E.ensureMeta(s);
 const updated=screen.globalContractDatabase();assert.match(updated,/&lt;img onerror=&quot;oops&quot;&gt;/);assert.match(updated,/Expires this offseason/);
});
