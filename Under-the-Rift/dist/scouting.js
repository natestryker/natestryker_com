import {overall,effectiveSkill,scoutTerms} from './engine.js';
import {traitTier} from './data.js';

const hash=text=>{let value=2166136261;for(const c of text)value=Math.imul(value^c.charCodeAt(0),16777619);return value>>>0;};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const scoutingComplete=(s,p)=>p.team===s.team||p.scout>=2;

// Stable report bias uses neither the match RNG nor the number of times a
// screen was opened. The real value is contained in an asymmetric interval.
export function scoutEstimate(s,p,skill=null){
 const value=skill?effectiveSkill(p,skill):overall(p);
 if(scoutingComplete(s,p))return {low:value,high:value,estimate:value,exact:true};
 const level=scoutTerms(s,p).level,min=skill?1:50,max=100,v=Math.round(value),broad=10-level*2;
 const salt=`${p.id}|${p.draftYear||2026}|${s.team}|${skill||'overall'}`;
 const interval=(radius,stage)=>{
  const roll=hash(salt+'|'+stage),offset=roll%(2*radius-1)-(radius-1),bias=offset||((roll>>>8)&1?1:-1);
  const low=clamp(v-radius+bias,min,max-2*radius);return {low,high:low+2*radius};
 };
 let bounds=interval(broad,'initial');
 if(p.scout===1){
  const radius=Math.max(2,5-level),next=interval(radius,'report');
  const low=clamp(next.low,bounds.low,bounds.high-2*radius);bounds={low,high:low+2*radius};
 }
 return {...bounds,estimate:(bounds.low+bounds.high)/2,exact:false};
}

// Scouting improves the report without changing the player's place on a board.
export const scoutOrderingEstimate=(s,p)=>scoutEstimate(s,{...p,scout:0}).estimate;

export function scoutingLabel(s,p,skill=null){
 const report=scoutEstimate(s,p,skill);
 return report.exact?String(skill?Math.round(report.estimate):report.estimate):`${report.low}–${report.high}`;
}

export function knownTraits(s,p){
 if(scoutingComplete(s,p))return [...p.traits];
 if(p.scout===1)return p.traits.filter(t=>['common','rare'].includes(traitTier(t)));
 return p.traits.filter(t=>traitTier(t)==='common').slice(0,1);
}
