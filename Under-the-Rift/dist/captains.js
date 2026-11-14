export const CAPTAIN_TENURE_TIE=2;

// A current stint counts academy service too; renewing or promoting never resets it.
export function clubJoinStep(s,p){
 if(p.clubTenure?.team===p.team)return p.clubTenure.since;
 const history=s.discoveries?.history?.[p.id];
 if(history?.team===p.team)return Math.max(0,Math.min(s.step,history.since));
 const service=s.career?.service?.[s.team+':'+p.id];
 if(p.team===s.team&&service)return Math.max(0,Math.min(s.step,service.firstStep));
 return 0;
}

export function ensureClubTenure(s){
 for(const p of s.players){
  if(p.team<0){p.clubTenure=null;continue;}
  if(!p.clubTenure)p.clubTenure={team:p.team,since:clubJoinStep(s,p)};
  else if(p.clubTenure.team!==p.team)p.clubTenure={team:p.team,since:s.step};
 }
}

export function setPlayerTeam(s,p,team){
 if(p.team!==team){p.team=team;p.clubTenure=team<0?null:{team,since:s.step};}
 return p;
}

export function teamCaptain(s,team=s.team){
 if(!s.teams[team])return null;
 const players=s.players.filter(p=>p.team===team);
 const special=players.find(p=>p.secretProspect);if(special)return special;
 if(!players.length)return null;
 const earliest=Math.min(...players.map(p=>clubJoinStep(s,p)));
 return players.filter(p=>clubJoinStep(s,p)<=earliest+CAPTAIN_TENURE_TIE)
  .sort((a,b)=>b.age-a.age||clubJoinStep(s,a)-clubJoinStep(s,b)||a.id.localeCompare(b.id))[0];
}

export function validateCaptaincy(s,fail){
 for(const p of s.players){
  const t=p.clubTenure;if(t===undefined||t===null)continue;
  if(typeof t!=='object'||Array.isArray(t)||!Number.isInteger(t.team)||!s.teams[t.team]||!Number.isInteger(t.since)||t.since<0||t.since>s.step)fail();
 }
}
