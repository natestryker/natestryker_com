import {FOG_REGIONS,FOG_OBSERVE_MS,FOG_LOST_MS,FOG_ANSWER_MS,fogScenario,fogChoices,fogPosition,fogVisible} from './fog-tracking-data.js';

const paths=[[[70,218],[97,181],[129,156],[162,150]],[[236,59],[214,94],[216,137],[242,173]]];
const point=p=>p.map(n=>n.toFixed(1)).join(',');
const line=path=>path.map(point).join(' ');

export function fogMap(c,{elapsed=null,reveal=false,choices=[]}={}){
 const q=fogScenario(c),destination=FOG_REGIONS[q.target];
 const regions=Object.entries(FOG_REGIONS).map(([key,r])=>{
  const number=choices.indexOf(key),correct=reveal&&key===q.target,wrong=reveal&&key===c.answer&&!correct;
  return `<g class="fog-region${correct?' fog-correct':wrong?' fog-wrong':''}"><circle cx="${r.point[0]}" cy="${r.point[1]}" r="${number>=0||correct||wrong?14:5}"/>${number>=0?`<text x="${r.point[0]}" y="${r.point[1]+4}" class="fog-number">${number+1}</text>`:''}</g>`;
 }).join('');
 let tracks='';
 if(reveal){
  const route=[...q.path,destination.point];
  tracks=`<polyline class="fog-route" points="${line(route)}"/><circle class="fog-last" cx="${q.path.at(-1)[0]}" cy="${q.path.at(-1)[1]}" r="6"/>`;
 }else if(elapsed!==null&&fogVisible(elapsed)){
  const progress=Math.min(1,elapsed/FOG_LOST_MS),j=fogPosition(q.path,progress);
  const trail=Array.from({length:7},(_,i)=>fogPosition(q.path,Math.max(0,progress-(6-i)*.022)));
  tracks=`<polyline class="fog-trail" points="${line(trail)}"/>`+paths.map((path,i)=>{
   const p=fogPosition(path,progress);
   return `<g class="fog-enemy"><circle cx="${p[0]}" cy="${p[1]}" r="9"/><text x="${p[0]}" y="${p[1]+3.5}">${i?'S':'M'}</text></g>`;
  }).join('')+`<g class="fog-jungler"><circle cx="${j[0]}" cy="${j[1]}" r="13"/><text x="${j[0]}" y="${j[1]+4.5}">J</text></g>`;
 }
 return `<svg viewBox="0 0 320 300" role="img" aria-label="${reveal?'Jungler route revealed':elapsed===null?'Map destination choices':fogVisible(elapsed)?'Enemy movements; track the J marker':'Enemy markers hidden by fog of war'}" class="fog-map">
  <rect x="5" y="5" width="310" height="290" rx="16" fill="#192b2a"/>
  <path d="M53 109 Q80 145 108 136 L147 97 128 53 69 53Z M173 202 209 157 267 181 267 246 196 246Z" fill="#243e36"/>
  <path d="M32 268 V32 H288 M32 268 H288 V32 M32 268 L288 32" fill="none" stroke="#6e7c6c" stroke-width="9" stroke-linejoin="round"/>
  <path d="M63 57 Q136 114 166 158 T259 243" fill="none" stroke="#345c6c" stroke-width="19"/>
  <circle cx="105" cy="100" r="20" fill="#243842" stroke="#71868c"/><circle cx="218" cy="205" r="20" fill="#243842" stroke="#71868c"/>
  <path d="M74 151 108 117 M190 183 246 143 M138 72 183 106 M90 204 146 238" stroke="#4e6554" stroke-width="13" stroke-linecap="round"/>
  <circle cx="32" cy="268" r="13" fill="#df8c48"/><circle cx="288" cy="32" r="13" fill="#a94f59"/>
  <g class="fog-labels"><text x="90" y="22">TOP</text><text x="180" y="143">MID</text><text x="248" y="285">BOT</text><text x="78" y="75">BARON</text><text x="191" y="237">DRAGON</text><text x="188" y="58">UPPER JG</text><text x="69" y="254">LOWER JG</text></g>
  ${regions}${tracks}
 </svg>`;
}

export function fogReview(c){
 return `<div class="fog-review">${fogMap(c,{reveal:true})}<p>The dotted line follows J’s route. The gold dot is its last visible position; the green ring marks its destination.</p></div>`;
}

export function mountFogTracking(stage,c,{finish}){
 let timer=0,frame=0,done=false;
 const cleanup=()=>{done=true;clearTimeout(timer);cancelAnimationFrame(frame);};
 const complete=value=>{if(done)return;cleanup();finish(value);};
 let started=0;
 stage.innerHTML=`<div class="fog-layout"><div id="fog-map-host" tabindex="-1" role="group" aria-label="Track the enemy jungler on the map"></div><div class="fog-brief"><span class="tag">LIVE VISION</span><h3>Keep your eyes on J</h3><p>The gold-ringed <b>J</b> is the enemy jungler. M and S are other enemies. Watch J’s direction through the vision gaps.</p><p id="fog-status" role="status">Tracking enemy movements…</p><div class="fog-progress" aria-hidden="true"><i id="fog-progress"></i></div><p class="muted">The map goes dark before you make your call.</p></div></div>`;
 const host=stage.querySelector('#fog-map-host'),status=stage.querySelector('#fog-status'),progress=stage.querySelector('#fog-progress');
 let previous='';
 const observe=()=>{
  if(done)return;
  const elapsed=Math.min(FOG_OBSERVE_MS,performance.now()-started);
  host.innerHTML=fogMap(c,{elapsed});
  const message=elapsed>=FOG_LOST_MS?'Vision lost. Remember J’s last heading.':fogVisible(elapsed)?'J is visible — follow its direction.':'Vision gap — keep tracking.';
  if(message!==previous){status.textContent=message;previous=message;}
  progress.style.width=(100*(1-elapsed/FOG_OBSERVE_MS))+'%';
  frame=requestAnimationFrame(observe);
 };
 const question=()=>{
  if(done)return;
  cancelAnimationFrame(frame);
  const choices=fogChoices(c),deadline=performance.now()+FOG_ANSWER_MS;
  stage.innerHTML=`<div class="fog-layout"><div>${fogMap(c,{choices})}</div><div class="fog-brief"><span class="tag">ENEMY MISSING</span><h3>Where was J heading?</h3><p>Continue the jungler’s last visible direction. Choose the most likely destination.</p><p id="fog-countdown" role="timer" aria-label="Time remaining">8 seconds left</p><div class="fog-progress" aria-hidden="true"><i id="fog-progress"></i></div><div class="fog-answers">${choices.map((key,i)=>`<button data-fog-answer="${key}"><span>${i+1}</span>${FOG_REGIONS[key].label}</button>`).join('')}</div><p class="muted">Choose once · Tab, then Enter / Space</p></div></div>`;
  stage.querySelectorAll('[data-fog-answer]').forEach(button=>button.onclick=()=>complete(performance.now()>=deadline?NaN:button.dataset.fogAnswer));
  stage.querySelector('[data-fog-answer]').focus();
  const countdown=stage.querySelector('#fog-countdown'),bar=stage.querySelector('#fog-progress');
  let seconds=8;
  const tick=()=>{
   if(done)return;
   const remaining=Math.max(0,deadline-performance.now()),next=Math.ceil(remaining/1000);
   if(next!==seconds){countdown.textContent=next+' seconds left';seconds=next;}
   bar.style.width=100*remaining/FOG_ANSWER_MS+'%';
   frame=requestAnimationFrame(tick);
  };
  timer=setTimeout(()=>complete(NaN),FOG_ANSWER_MS);tick();
 };
 // Bring the whole moving map into view before the observation clock starts.
 host.innerHTML=fogMap(c,{elapsed:0});host.focus({preventScroll:true});host.scrollIntoView({block:'center',behavior:'instant'});
 started=performance.now();timer=setTimeout(question,FOG_OBSERVE_MS);observe();
 return cleanup;
}
