import {SKILLS,ROLES} from './data.js';
import {overall,starters,academy,getPlayer,composition} from './engine.js';

export const CLUB_APPROACHES=['Contend','Develop','Balanced'];

// Stored club identities survive reloads and manager changes. Migrating an old
// career adds a plan without rerolling any players, ratings or simulation RNG.
export function ensureLeague(s){
 for(const t of s.teams)t.development??={approach:CLUB_APPROACHES[t.id%3],focus:SKILLS[Math.floor(t.id/3)%SKILLS.length]};
}

export function clubPlan(s,team){
 const t=s.teams[team],identity=t.development||{approach:CLUB_APPROACHES[t.id%3],focus:SKILLS[Math.floor(t.id/3)%SKILLS.length]};
 const ps=starters(s,team),core=ps.slice().sort((a,b)=>overall(b)-overall(a)||b.learning-a.learning||a.id.localeCompare(b.id))[0];
 const needs=ROLES.slice().sort((a,b)=>overall(getPlayer(s,t.lineup[a]))-overall(getPlayer(s,t.lineup[b])));
 return {...identity,core,needs};
}

export function clubTraining(s,p,plan=clubPlan(s,p.team)){
 const weakest=SKILLS.slice().sort((a,b)=>p.skills[a]-p.skills[b])[0];
 return {
  intensity:p.fatigue>45?'Light':plan.approach==='Develop'&&p.age<24?'Intense':'Normal',
  focus:p.fatigue>65?'Recovery':p.trainingWeeks%3===0?plan.focus:plan.approach==='Balanced'?'Balanced':weakest
 };
}

// Value real improvements and complements to the existing five. Never compare
// a club to the human manager's rating.
export function recruitmentScore(s,p,team){
 const t=s.teams[team],plan=clubPlan(s,team),current=getPlayer(s,t.lineup[p.role]);
 if(overall(p)<=overall(current)+1)return -Infinity;
 const before=composition(s,team).bonus;
 let links;
 try{t.lineup[p.role]=p.id;links=composition(s,team).bonus-before;}
 finally{t.lineup[p.role]=current.id;}
 return (overall(p)-overall(current))*3+links*2+(plan.approach==='Develop'?Math.max(0,25-p.age)*.7+p.learning*2:0);
}

export function retainPlayer(s,p){
 const t=s.teams[p.team],plan=clubPlan(s,p.team);
 if(p.emergency)return false;
 if(p.id===plan.core.id||t.lineup[p.role]===p.id)return true;
 return p.squad==='academy'&&(p.age<24||plan.approach==='Develop')&&
  !academy(s,p.team).some(q=>q.role===p.role&&overall(q)>overall(p)+2&&q.learning>=p.learning);
}

export function validateLeague(s,fail){
 for(const t of s.teams)if(t.development&&(!CLUB_APPROACHES.includes(t.development.approach)||!SKILLS.includes(t.development.focus)))fail();
}
