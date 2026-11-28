import {BANK_VERSION,ROUND_LENGTH,RARITIES,buildBank,normalize,dayKey,dailyQuestions,createRun,validRun,submitAnswer,findAnswer,suggestAnswers} from './core.mjs';

const game=document.querySelector('#game'),score=document.querySelector('#score'),progress=document.querySelector('#progress');
const modeNote=document.querySelector('#mode-note'),review=document.querySelector('#review');
const storagePrefix='tank-intel:v2:';
let catalogue,bank=[],questions=[],run=null,day='',mode='daily',timer,correctionTimeout;
let rolloverMessage='',reviewQuery='',reviewRarity='';
const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const byId=id=>document.getElementById(id);
const total=()=>run?.results.reduce((sum,result)=>sum+result.points,0)??0;
const pointsLabel=points=>RARITIES.find(rarity=>rarity.points===points)?.name??'Miss';
const rarityBadge=answer=>`<span class="rarity ${escapeHTML(answer.rarityClass)}">${escapeHTML(answer.rarity)} <span>${answer.points}</span></span>`;
function fillDebriefAnswers(row,question,index){
  row.firstElementChild.innerHTML=`<label class="debrief-search-label" for="debrief-search-${index}">Search answers</label><input class="debrief-search" id="debrief-search-${index}" type="search" placeholder="Name, abbreviation, or rarity" aria-controls="debrief-list-${index}"><p class="debrief-answer-label" role="status" aria-live="polite"></p><ul class="answer-list" id="debrief-list-${index}"></ul>`;
  const input=row.querySelector('input'),list=row.querySelector('ul'),count=row.querySelector('[role="status"]');
  const answers=question.answers.toSorted((a,b)=>b.points-a.points||a.name.localeCompare(b.name));
  const search=()=>{
    const terms=input.value.trim().split(/\s+/).map(normalize).filter(Boolean);
    const matches=answers.filter(answer=>{
      const text=normalize([answer.name,...answer.aliases,answer.rarity].join(' '));
      return terms.every(term=>text.includes(term));
    });
    count.textContent=matches.length?`Accepted answers and rarities · ${matches.length} of ${answers.length}`:'No matching answers';
    list.innerHTML=matches.map(answer=>`<li><span>${escapeHTML(answer.name)}</span>${rarityBadge(answer)}</li>`).join('');
  };
  input.addEventListener('input',search);search();
}
function storageKey(){return storagePrefix+BANK_VERSION+':'+catalogue.meta.version+':'+day;}
function save(){try{localStorage.setItem(storageKey(),JSON.stringify(run));}catch{/* Session remains playable without storage. */}}
function read(){try{return JSON.parse(localStorage.getItem(storageKey()));}catch{return null;}}
function focusHeading(){game.querySelector('h2')?.focus();}
function updateSidebar(){
  score.textContent=total();
  progress.innerHTML=questions.map((_,i)=>{
    const result=run?.results[i],state=result?(result.points?'hit':'miss'):run?.index===i?'now':'';
    return `<span class="cell ${state}" aria-label="Prompt ${i+1}, ${result?result.points+' points':state==='now'?'current':'pending'}">${i+1}</span>`;
  }).join('');
  modeNote.textContent='A new daily set arrives at midnight Eastern. Incorrect guesses do not cost an attempt.';
  byId('daily').setAttribute('aria-pressed',String(mode==='daily'));
  byId('daily').classList.toggle('primary',mode==='daily');
  byId('practice').setAttribute('aria-pressed',String(mode==='review'));
}
function loadDaily({rollover=false}={}){
  clearInterval(timer);
  day=dayKey();questions=dailyQuestions(bank,day);
  const saved=read();run=validRun(saved,questions)?saved:null;
  rolloverMessage=rollover?'A new day has started in Eastern time. Your new daily set is ready.':'';
  if(mode==='daily')render();
}
function checkRollover(){
  if(bank.length&&day!==dayKey()){loadDaily({rollover:true});return true;}
  return false;
}
function setMode(next){
  clearInterval(timer);checkRollover();mode=next;
  const reviewing=mode==='review';
  byId('daily-console').hidden=reviewing;review.hidden=!reviewing;
  document.body.classList.toggle('reviewing',reviewing);
  updateSidebar();
  if(reviewing)renderReview();else render();
}
function begin(){
  checkRollover();if(run)return;
  run=createRun(questions);save();render(true);
}
function recordAnswer(value,reason='answer'){
  if(checkRollover())return;
  const outcome=submitAnswer(run,questions[run.index],value,reason);
  if(outcome.kind==='retry'){showRetry(outcome.suggestions);return;}
  if(outcome.kind==='recorded'){save();render(true);}
}
function showRetry(suggestions){
  const feedback=byId('answer-feedback'),input=byId('guess');
  feedback.textContent=suggestions.length?'Did you mean…':'No match—try again.';
  input.setAttribute('aria-invalid','true');offerSuggestions(suggestions);
  input.focus();input.select();
}
function offerSuggestions(suggestions){
  const box=byId('suggestions');box.replaceChildren();
  for(const answer of suggestions){
    const button=document.createElement('button');button.type='button';button.className='btn correction';button.textContent='Use '+answer.name;
    button.addEventListener('click',()=>recordAnswer(answer.name));box.append(button);
  }
}
function advance(){
  if(checkRollover())return;
  if(!run||run.results.length!==run.index+1)return;
  run.index++;run.deadline=Date.now()+ROUND_LENGTH;save();render(true);
}
function updateClock(){
  if(checkRollover()||mode!=='daily'||!run||run.index>=questions.length||run.results[run.index])return;
  const remaining=Math.max(0,run.deadline-Date.now());
  if(!remaining){recordAnswer('','timeout');return;}
  const clock=byId('clock');if(!clock)return;
  clock.textContent=Math.ceil(remaining/1000)+' s';clock.classList.toggle('low',remaining<=5000);
  byId('time-fill').style.transform=`scaleX(${remaining/ROUND_LENGTH})`;
}
function render(focus=false){
  clearInterval(timer);clearTimeout(correctionTimeout);updateSidebar();if(mode!=='daily')return;
  if(!run){
    game.innerHTML=`<p class="eyebrow">Daily · ${day}</p><h2 tabindex="-1">Report to the garage</h2>
      ${rolloverMessage?`<p class="reset-notice" role="status">${escapeHTML(rolloverMessage)}</p>`:''}
      <p>Seven prompts, 25 seconds each. Rarer answers earn more points, with one Tank Ace answer worth 100.</p>
      <button class="btn primary" id="start" type="button">Start daily</button>`;
    byId('start').addEventListener('click',begin);
  }else if(run.index>=questions.length){
    const rows=run.results.map((result,index)=>`<tr class="debrief-result"><td><button class="debrief-toggle" type="button" aria-expanded="false" aria-controls="debrief-answers-${index}" data-prompt="${index}"><span>${escapeHTML(questions[index].title)}</span><svg viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1 5 5 5-5"/></svg></button></td><td>${escapeHTML(result.name||'—')}<small>${escapeHTML(pointsLabel(result.points))}</small></td><td>${result.points}</td></tr><tr class="debrief-answer-row" id="debrief-answers-${index}" hidden><td colspan="3"></td></tr>`).join('');
    game.innerHTML=`<p class="eyebrow">Daily · ${day}</p><h2 tabindex="-1">Debrief · ${total()} / 700</h2>
      <p>${run.results.filter(r=>r.points).length} of 7 prompts scored points. Come back after midnight Eastern for a new set.</p>
      <table class="scoretable"><thead><tr><th>Prompt</th><th>Your answer</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>
      <button class="btn primary" id="copy" type="button">Copy score</button><p id="copy-status" role="status"></p>`;
    for(const button of game.querySelectorAll('.debrief-toggle'))button.addEventListener('click',()=>{
      const row=byId(button.getAttribute('aria-controls')),expanded=button.getAttribute('aria-expanded')==='true';
      button.setAttribute('aria-expanded',String(!expanded));row.hidden=expanded;
      if(!expanded&&!row.querySelector('ul')){
        const index=Number(button.dataset.prompt);
        fillDebriefAnswers(row,questions[index],index);
      }
    });
    byId('copy').addEventListener('click',async()=>{
      const shareText=['Tank Intel · '+day+' · '+total()+'/700',run.results.map(result=>({0:'⬛',20:'🟥',40:'🟨',60:'🟦',80:'🟪',100:'🏅'})[result.points]).join(''),'https://natestryker.com/games/tank-intel/'].join('\n');
      try{await navigator.clipboard.writeText(shareText);byId('copy-status').textContent='Daily score copied.';}catch{byId('copy-status').textContent=shareText;}
    });
  }else{
    const question=questions[run.index],result=run.results[run.index];
    const heading=`<p class="eyebrow">Prompt ${run.index+1} of ${questions.length} · ${escapeHTML(question.category)}</p><h2 tabindex="-1">${escapeHTML(question.title)}</h2>`;
    if(result){
      const message=result.points?result.name+' · +'+result.points:result.reason==='timeout'?'Time ran out':'Prompt passed';
      const rarityClass=RARITIES.find(rarity=>rarity.points===result.points)?.className;
      game.innerHTML=`${heading}<p class="${result.points?'hittext '+rarityClass:'misstext'}" role="status">${escapeHTML(message)}</p>
        <div class="actions result-actions"><button class="btn primary" id="next" type="button">${run.index+1===questions.length?'View debrief':'Next prompt'}</button></div>`;
      byId('next').addEventListener('click',advance);
    }else{
      game.innerHTML=`<span id="clock" role="timer" aria-label="Time remaining"></span>${heading}
        <div class="timebar" aria-hidden="true"><div id="time-fill"></div></div>
        <form id="answer-form"><label for="guess">Your answer</label><input id="guess" type="text" autocomplete="off" spellcheck="false" maxlength="100" aria-describedby="answer-feedback" required><button class="btn primary" type="submit">Submit</button></form>
        <p id="answer-feedback" role="status" aria-live="polite"></p><div class="suggestions" id="suggestions" aria-label="Suggested corrections"></div>
        <button class="quiet" id="pass" type="button">Pass prompt</button>`;
      const input=byId('guess');
      input.addEventListener('input',()=>{
        clearTimeout(correctionTimeout);input.setCustomValidity('');input.removeAttribute('aria-invalid');byId('answer-feedback').textContent='';byId('suggestions').replaceChildren();
        correctionTimeout=setTimeout(()=>{
          if(!input.isConnected||mode!=='daily'||normalize(input.value).length<3||findAnswer(question,input.value))return;
          const suggestions=suggestAnswers(question,input.value);
          if(suggestions.length){byId('answer-feedback').textContent='Did you mean…';offerSuggestions(suggestions);}
        },220);
      });
      byId('answer-form').addEventListener('submit',event=>{
        event.preventDefault();const value=input.value.trim();
        if(!value){input.setCustomValidity('Enter an answer or pass the prompt.');input.reportValidity();return;}
        recordAnswer(value);
      });
      byId('pass').addEventListener('click',()=>recordAnswer('','pass'));
      updateClock();
      if(byId('guess')){timer=setInterval(updateClock,125);if(focus)input.focus();}
      return;
    }
  }
  if(focus)focusHeading();
}
function answerRow(answer){
  return `<tr><td><strong>${escapeHTML(answer.name)}</strong><small>${answer.aliases.length?'Aliases: '+escapeHTML(answer.aliases.join(', ')):'Full name accepted'}</small></td>
    <td>${rarityBadge(answer)}</td><td><span class="evidence-kind">${answer.method==='observed-popularity'?'Observed popularity':'Estimated rarity'}</span><p>${escapeHTML(answer.basis)}</p><a href="${escapeHTML(answer.source)}" target="_blank" rel="noopener noreferrer">Reference</a>${answer.statisticsSource?` · <a href="${escapeHTML(answer.statisticsSource)}" target="_blank" rel="noopener noreferrer">Statistics</a>`:''}</td></tr>`;
}
function renderReview(){
  byId('review-summary').textContent=`${bank.length} prompts · ${catalogue.tanks.length} vehicles · source snapshot ${catalogue.meta.retrievedOn}`;
  const terms=reviewQuery.trim().split(/\s+/).map(normalize).filter(Boolean),container=byId('review-list');let count=0;container.replaceChildren();
  for(const question of bank){
    const title=normalize(question.title+' '+question.category);
    const answers=question.answers.filter(answer=>(!reviewRarity||answer.rarity===reviewRarity)&&terms.every(term=>(title+normalize([answer.name,...answer.aliases].join(' '))).includes(term)));
    if(!answers.length)continue;count++;
    const details=document.createElement('details');details.className='review-prompt';
    const ace=question.answers.find(answer=>answer.points===100);
    details.innerHTML=`<summary><span>${escapeHTML(question.title)}<small>${escapeHTML(question.category)} · ${question.answers.length} accepted answers</small></span><span class="review-ace">Tank Ace: ${escapeHTML(ace.name)}</span></summary>`;
    const fill=()=>{
      if(details.querySelector('.review-answers'))return;
      const body=document.createElement('div');body.className='review-answers';
      body.innerHTML=`<p>${escapeHTML(question.detail)}</p><table class="review-table"><thead><tr><th>Answer and aliases</th><th>Rarity / points</th><th>Evidence and source</th></tr></thead><tbody>${answers.toSorted((a,b)=>b.points-a.points||a.name.localeCompare(b.name)).map(answerRow).join('')}</tbody></table>`;
      details.append(body);
    };
    details.addEventListener('toggle',()=>{if(details.open)fill();});
    if(terms.length||reviewRarity){fill();details.open=true;}
    container.append(details);
  }
  byId('review-count').textContent=`${count} of ${bank.length} prompts shown`;
  if(!count)container.innerHTML='<p>No matching prompts or answers.</p>';
}
async function boot(){
  byId('daily').disabled=true;byId('practice').disabled=true;
  try{
    const response=await fetch('./catalogue.json');if(!response.ok)throw Error('Unable to load the answer catalogue');
    catalogue=await response.json();bank=buildBank(catalogue);if(bank.length<7)throw Error('Answer catalogue is incomplete');
    byId('daily').disabled=false;byId('practice').disabled=false;
    byId('daily').addEventListener('click',()=>setMode('daily'));
    byId('practice').addEventListener('click',()=>setMode('review'));
    byId('review-back').addEventListener('click',()=>setMode('daily'));
    byId('review-search').addEventListener('input',event=>{reviewQuery=event.target.value;renderReview();});
    byId('review-rarity').innerHTML='<option value="">Every rarity</option>'+RARITIES.map(r=>`<option>${r.name}</option>`).join('');
    byId('review-rarity').addEventListener('change',event=>{reviewRarity=event.target.value;renderReview();});
    byId('review-expand').addEventListener('click',()=>{for(const details of byId('review-list').querySelectorAll('details'))details.open=true;});
    byId('review-collapse').addEventListener('click',()=>{for(const details of byId('review-list').querySelectorAll('details'))details.open=false;});
    byId('rarity-legend').innerHTML=RARITIES.map(r=>`<span class="rarity ${r.className}">${r.name}<span>${r.points}</span></span>`).join('');
    loadDaily();if(new URLSearchParams(location.search).has('review'))setMode('review');
    setInterval(checkRollover,1000);
    window.addEventListener('focus',()=>{if(!checkRollover())updateClock();});
    window.addEventListener('pageshow',()=>{if(!checkRollover())updateClock();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!checkRollover())updateClock();});
  }catch(error){
    game.innerHTML='<h2>Unable to load Tank Intel</h2><p>The answer catalogue could not load. Reload the page to try again.</p><button class="btn primary" id="reload" type="button">Reload</button>';
    byId('reload').addEventListener('click',()=>location.reload());console.error(error);
  }
}
boot();
