import {WAVE_ACTIONS,tacticalScenario,tacticalChoices,tacticalAnswerLabel} from './tactical-checks-data.js';
export const TACTICAL_ANSWER_MS=15000;

export function tacticalBoard(c,{reveal=false}={}){
 const q=tacticalScenario(c),choices=tacticalChoices(c);
 if(c.type==='wave'){
  const center=64+q.position*272;
  const minions=(count,side)=>Array.from({length:count},(_,i)=>`<circle cx="${center+(side==='ally'?-1:1)*(12+Math.floor(i/3)*14)}" cy="${70+(i%3)*19}" r="5" fill="${side==='ally'?'#edaa61':'#df7c85'}"/>`).join('');
  return `<svg class="wave-board" viewBox="0 0 400 180" role="img" aria-label="Wave position: ${q.allies} allied and ${q.enemies} enemy minions"><rect x="2" y="2" width="396" height="176" rx="14" fill="#263e37"/><path d="M30 90H370" stroke="#7b856e" stroke-width="30"/><path d="M30 90H370" stroke="#a6a88e" stroke-width="2" stroke-dasharray="4 6"/><rect x="20" y="70" width="22" height="38" fill="#e4a05d"/><rect x="358" y="70" width="22" height="38" fill="#ba6570"/>${minions(q.allies,'ally')}${minions(q.enemies,'enemy')}<g fill="#e6ede2" font-size="12" text-anchor="middle"><text x="65" y="30">YOUR TOWER</text><text x="333" y="30">ENEMY TOWER</text><text x="100" y="155">${q.allies} allied minions</text><text x="299" y="155">${q.enemies} enemy minions</text></g></svg>`;
 }
 return `<svg class="ward-board" viewBox="0 0 320 300" role="img" aria-label="Ward locations and the reported enemy approach"><rect x="5" y="5" width="310" height="290" rx="14" fill="#192b2a"/><path d="M32 268V32H288M32 268H288V32M32 268L288 32" stroke="#75806f" stroke-width="9" fill="none"/><path d="M63 57Q136 114 166 158T259 243" stroke="#3d7180" stroke-width="19" fill="none"/><polyline points="${q.route.map(p=>p.join(',')).join(' ')}" class="ward-approach"/><circle cx="${q.goal[0]}" cy="${q.goal[1]}" r="18" fill="#9f662f" stroke="#f1c177"/><text x="${q.goal[0]}" y="${q.goal[1]+33}" fill="#f4d5a4" font-size="10" text-anchor="middle">${q.objective}</text>${q.spots.map(([id,label,x,y])=>`<g class="ward-spot${reveal&&id===q.answer?' correct':reveal&&id===c.answer?' wrong':''}" ${reveal?'':`data-tactical-answer="${id}" role="button" tabindex="0" aria-label="Place ward: ${label}"`}><title>${label}</title><circle cx="${x}" cy="${y}" r="15"/><text x="${x}" y="${y+4}" text-anchor="middle">${choices.indexOf(id)+1}</text></g>`).join('')}</svg>`;
}

export function tacticalReview(c){
 return `<div class="tactical-result"><p>Your choice: <b>${tacticalAnswerLabel(c,c.answer)||'No choice made'}</b> · Best choice: <b>${tacticalAnswerLabel(c,tacticalScenario(c).answer)}</b></p>${tacticalBoard(c,{reveal:true})}</div>`;
}

export function mountTacticalCheck(stage,c,{finish}){
 const q=tacticalScenario(c),choices=tacticalChoices(c);
 let timer=0,done=false,deadline=0;
 const cleanup=()=>{done=true;clearTimeout(timer);};
 const complete=value=>{if(done)return;cleanup();finish(value);};
 stage.innerHTML=`<div class="tactical-layout"><div>${tacticalBoard(c)}<p class="tactical-legend">${c.type==='ward'?'Dashed red line: reported enemy approach. Gold circle: the area to protect.':'Gold minions: your wave. Red minions: the enemy wave.'}</p></div><div><h3>${q.title}</h3><p>${q.brief}</p><p class="tactical-goal"><b>Your goal:</b> ${c.type==='wave'?q.goal:'Cover the reported approach with one safe ward.'}</p><p id="tactical-countdown" role="timer">15 seconds left</p><div class="tactical-answers">${choices.map((id,i)=>`<button data-tactical-answer="${id}"><span>${i+1}</span>${tacticalAnswerLabel(c,id)}</button>`).join('')}</div><p class="muted">Choose once · Tab, then Enter / Space${c.type==='ward'?' · Map markers are selectable too':''}</p></div></div>`;
 stage.querySelectorAll('[data-tactical-answer]').forEach(button=>{
  const choose=()=>complete(performance.now()>=deadline?NaN:button.dataset.tacticalAnswer);
  button.onclick=choose;
  button.onkeydown=event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();if(!event.repeat)choose();}};
 });
 stage.querySelector('button[data-tactical-answer]').focus();stage.scrollIntoView({block:'start',behavior:'instant'});
 deadline=performance.now()+TACTICAL_ANSWER_MS;
 const countdown=stage.querySelector('#tactical-countdown');
 const tick=()=>{
  if(done)return;const remaining=deadline-performance.now();
  if(remaining<=0){complete(NaN);return;}
  countdown.textContent=Math.ceil(remaining/1000)+' seconds left';timer=setTimeout(tick,Math.min(1000,remaining));
 };
 tick();return cleanup;
}
