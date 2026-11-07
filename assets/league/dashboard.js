import {aggregate,filterMatches,queueName,countsForStats,isHistoryOnly} from './stats.mjs';
import {loadItemNames} from './items.mjs';
const $ = id=>document.getElementById(id);
const historyPage=document.body.dataset.view==='history';
const pageSize=historyPage ? 40 : 20;
const filterIds=['search','champion-search','item-search','queue','result','account'];
const number = (n,d=1)=>Number(n || 0).toLocaleString(undefined,{maximumFractionDigits:d});
const escape = s=>String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stat = (label,value,detail='')=>`<div class="stat"><small>${escape(label)}</small><strong>${escape(value)}</strong><small>${escape(detail)}</small></div>`;
const table = (headers,rows)=>`<table><thead><tr>${headers.map(x=>`<th scope="col">${escape(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${escape(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
function chart(target,series,labels) {
  const all=series.flatMap(s=>s.values).filter(Number.isFinite);
  if(!all.length){target.textContent='No observations yet.';return;}
  const max=Math.max(1,...all), min=Math.min(0,...all), span=max-min;
  const x=i=>45+i*400/Math.max(1,labels.length-1), y=v=>140-(v-min)/span*115;
  let svg=`<svg class="chart" viewBox="0 0 470 190" role="img" aria-label="${escape(series.map(s=>s.name).join(' and '))} chart"><path d="M45 20V140H450" fill="none" stroke="#304058"/><text x="2" y="28">${number(max)}</text><text x="2" y="140">${number(min)}</text>`;
  series.forEach((s,j)=>{
    let path='',active=false;
    s.values.forEach((v,i)=>{if(!Number.isFinite(v)){active=false;return;} path+=`${active?'L':'M'}${x(i)},${y(v)} `;active=true;});
    svg+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2"/>`;
    s.values.forEach((v,i)=>{if(Number.isFinite(v)) svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color}"><title>${escape(labels[i])}: ${escape(s.name)} ${number(v)}</title></circle>`;});
    svg+=`<text x="45" y="${160+j*15}" style="fill:${s.color}">${escape(s.name)}</text>`;
  });
  svg+='</svg>';
  target.innerHTML=svg+`<details class="chart-description"><summary>View graph data</summary>${table(['Observation',...series.map(s=>s.name)],labels.map((l,i)=>[l,...series.map(s=>Number.isFinite(s.values[i]) ? number(s.values[i]) : '—')]))}</details>`;
}
async function main(){
  const response=await fetch('data/league/public.json',{cache:'no-cache'});
  if(!response.ok) throw new Error('Statistics could not be loaded. Please try again later.');
  const data=await response.json();
  let itemNames={};
  const accounts=data.accounts || [{id:'legacy',profile:data.profile,ranked:data.ranked,mastery:data.mastery,updatedAt:data.updatedAt}];
  const accountName=a=>a.profile?.riotId || a.label || 'Account';
  data.matches=data.matches.map(m=>({...m,accountId:m.accountId || 'legacy',accountName:m.accountName || data.profile?.riotId || 'Account',recordId:m.recordId || m.id}));
  accounts.forEach(a=>{const option=document.createElement('option');option.value=a.id;option.textContent=accountName(a);$('account').append(option);});
  if(data.accounts){$('profile').hidden=false;$('profile').textContent=accounts.map(accountName).join(' / ');}

  if(data.profile) {$('profile').hidden=false;$('profile').textContent=`${data.profile.riotId} · ${data.profile.platform.toUpperCase()} · Level ${data.profile.level}`;}
  const age=Date.now()-Date.parse(data.updatedAt);
  if(data.updatedAt){$('status').hidden=false;$('status').textContent=`Last updated ${new Date(data.updatedAt).toLocaleString()}${age>3*3600000?' · Updates delayed':''}`;}
  $('dashboard').hidden=false;
  const total=aggregate(data.matches);
  if(!historyPage) $('summary').innerHTML=stat('Games',number(total.games,0),'ARAM, Arena and remakes excluded')+stat('Wins / losses',`${total.wins} / ${total.losses}`)+stat('Win rate',`${number(total.winRate)}%`)+stat('KDA',number(total.kda,2))+stat('CS / min',number(total.cs,2))+stat('Avg champion damage',number(total.damage,0));
  const expandedRanks=new Set();
  function renderAccounts(){
    const selected=accounts.filter(a=>!$('account').value || a.id===$('account').value);
    $('ranked').replaceChildren();$('rank-graph').replaceChildren();
    const colors=['#ff974b','#75dfbf','#a8b7ff'];
    selected.forEach((a,index)=>{
      const latest=a.ranked.at(-1), previous=a.ranked.at(-2);
      const panel=document.createElement('div');
      panel.innerHTML=`<h3>${escape(accountName(a))}</h3><p class="muted">${a.updatedAt ? `Last updated ${escape(new Date(a.updatedAt).toLocaleString())}` : 'No collection yet'}${a.collectionFailed?' / Collection delayed':''}</p>`;
      if(!latest?.entries.length) panel.insertAdjacentHTML('beforeend','<p class="muted">No ranked placement observed</p>');
      for(const e of latest?.entries || []){
        const before=previous?.entries.find(p=>p.queueType===e.queueType);
        let change='';
        if(before){
          if(before.tier===e.tier && before.rank===e.rank){const delta=e.leaguePoints-before.leaguePoints;change=` (${delta>=0?'+':''}${delta} LP since previous observation)`;}
          else change=` (previously ${before.tier} ${before.rank}, ${before.leaguePoints} LP)`;
        }
        panel.insertAdjacentHTML('beforeend',`<p class="rank-line">${escape(e.queueType.replace('RANKED_','').replaceAll('_',' '))} / ${escape(e.tier)} ${escape(e.rank)} / <span class="accent">${e.leaguePoints} LP</span> / ${e.wins} W / ${e.losses} L${escape(change)}</p>`);
      }
      $('ranked').append(panel);
      const graph=document.createElement('details'), heading=document.createElement('summary'), plot=document.createElement('div');
      graph.className='rank-account';graph.open=expandedRanks.has(a.id);
      heading.innerHTML=`<span>${escape(accountName(a))}</span><span class="rank-arrow" aria-hidden="true">&#8594;</span>`;
      graph.append(heading,plot);$('rank-graph').append(graph);
      graph.addEventListener('toggle',()=>{
        if(!graph.isConnected) return;
        if(graph.open) expandedRanks.add(a.id);else expandedRanks.delete(a.id);
      });
      const series=[];
      ['RANKED_SOLO_5x5','RANKED_FLEX_SR'].forEach((queue,j)=>{
        const groups=new Set(a.ranked.flatMap(s=>s.entries.filter(e=>e.queueType===queue).map(e=>`${e.tier} ${e.rank}`)));
        for(const group of groups) series.push({name:`${j?'Flex':'Solo'} / ${group}`,color:j?'#75dfbf':colors[index%colors.length],values:a.ranked.map(s=>{const e=s.entries.find(e=>e.queueType===queue && `${e.tier} ${e.rank}`===group);return e ? e.leaguePoints : null;})});
      });
      chart(plot,series,a.ranked.map(s=>new Date(s.at).toLocaleString()));
    });
  }
  [...new Set(data.matches.map(m=>m.queue))].sort((a,b)=>a-b).forEach(q=>{const option=document.createElement('option');option.value=q;option.textContent=queueName(q);$('queue').append(option);});
  let page=0,filtered=[];
  function history(){
    const count=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,count-1);
    $('match-count').textContent=`${filtered.length} matching matches`;
    $('page').textContent=`${page+1} / ${count}`;$('previous').disabled=page===0;$('next').disabled=page===count-1;
    $('matches').innerHTML=filtered.slice(page*pageSize,page*pageSize+pageSize).map(m=>`<details class="match" id="match-${escape(m.recordId)}"><summary><strong>${escape(m.champion)}</strong> / ${escape(m.accountName)} · <span class="${m.win?'win':'loss'}">${m.remake?'Remake':m.win?'Victory':'Defeat'}</span> · ${m.kills}/${m.deaths}/${m.assists} · ${escape(queueName(m.queue))}${isHistoryOnly(m)?' / History only - excluded from stats':''} · ${escape(new Date(m.date).toLocaleString())}</summary><div class="match-details">${Object.entries({'Match ID':m.id,Account:m.accountName,Role:m.role,Duration:`${Math.floor(m.duration/60)}:${String(Math.floor(m.duration%60)).padStart(2,'0')}`,KDA:number(m.kda,2),CS:m.cs,'CS / min':number(m.csPerMinute,2),'Champion damage':number(m.damage,0),'Damage taken':number(m.damageTaken,0),Gold:number(m.gold,0),Vision:m.vision,'Wards placed':m.wards,'Control wards':m.controlWards,Healing:number(m.healing,0),'Objective damage':number(m.objectiveDamage,0),'Turret damage':number(m.turretDamage,0),'Kill participation':`${number(m.killParticipation)}%`,'Double / triple / quadra / penta':`${m.doubleKills}/${m.tripleKills}/${m.quadraKills}/${m.pentaKills}`,Patch:m.patch,Items:(m.items || []).filter(id=>id>0).map(id=>itemNames[id] || `Item #${id}`).join(', ') || 'None'}).map(([k,v])=>`<div>${escape(k)}: <strong>${escape(v)}</strong></div>`).join('')}</div></details>`).join('') || '<p>No matches match these filters.</p>';
  }
  function render(){
    page=0;filtered=filterMatches(data.matches,$('search').value,$('queue').value,$('result').value,$('champion-search').value,$('item-search').value,itemNames).filter(m=>!$('account').value || m.accountId===$('account').value);
    if($('history-link')){
      const params=new URLSearchParams();
      filterIds.forEach(id=>{if($(id).value) params.set(id,$(id).value);});
      $('history-link').href=`match-history.html${params.size?'?'+params:''}`;
    }
    if(historyPage){history();return;}
    renderAccounts();
    const games=filtered.filter(countsForStats), champions=[...new Set(games.map(m=>m.champion))];
    $('champions').innerHTML=table(['Champion','Games','W / L','Win rate','KDA','CS/min','Avg damage'],champions.map(name=>({name,...aggregate(games.filter(m=>m.champion===name))})).sort((a,b)=>b.games-a.games).map(s=>[s.name,s.games,`${s.wins} / ${s.losses}`,`${number(s.winRate)}%`,number(s.kda,2),number(s.cs,2),number(s.damage,0)]));
    const recent=games.slice(0,30).reverse();chart($('performance'),[{name:'KDA',color:'#ff974b',values:recent.map(m=>m.kda)},{name:'CS/min',color:'#75dfbf',values:recent.map(m=>m.csPerMinute)}],recent.map(m=>`${new Date(m.date).toLocaleDateString()} ${m.champion} ${m.accountName} ${m.id}`));
    $('records').innerHTML=[['Most kills','kills'],['Most assists','assists'],['Highest KDA','kda'],['Most damage','damage'],['Best CS/min','csPerMinute'],['Highest vision','vision'],['Longest game (min)','duration'],['Most pentakills','pentaKills']].map(([label,key])=>{
      const best=games.reduce((best,m)=>!best||m[key]>best[key]?m:best,null);
      if(!best) return stat(label,'-','No games');
      return `<div class="stat record"><small>${escape(label)}</small><strong>${escape(number(key==='duration'?best[key]/60:best[key],2))}</strong><small>${escape(best.champion)} / ${escape(queueName(best.queue))}</small><small>${escape(best.accountName)}</small><time datetime="${escape(new Date(best.date).toISOString())}">${escape(new Date(best.date).toLocaleString())}</time><small>${escape(best.id)}</small><a class="record-link" href="#match-${encodeURIComponent(best.recordId)}" aria-label="${escape(`View ${label} match: ${best.champion}, ${new Date(best.date).toLocaleString()}, ${best.id}`)}">View match <span aria-hidden="true">&#8599;</span></a></div>`;
    }).join('');history();
  }
  const initialFilters=new URLSearchParams(location.search);
  filterIds.forEach(id=>{if(initialFilters.has(id)) $(id).value=initialFilters.get(id);});
  filterIds.forEach(id=>$(id).addEventListener(id.endsWith('search')?'input':'change',render));
  function openLinkedMatch(){
    let id;
    try {id=decodeURIComponent(location.hash.slice(1));} catch {return;}
    if(!id.startsWith('match-')) return;
    const matchId=id.slice(6);
    if(!data.matches.some(m=>m.recordId===matchId)) return;
    if(!filtered.some(m=>m.recordId===matchId)){
      ['search','champion-search','item-search','queue','result','account'].forEach(key=>{$(key).value='';});
      render();
    }
    page=Math.floor(filtered.findIndex(m=>m.recordId===matchId)/pageSize);
    history();
    const match=document.getElementById(id);
    match.open=true;
    const summary=match.querySelector('summary');
    summary.focus({preventScroll:true});
    match.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  window.addEventListener('hashchange',openLinkedMatch);
  $('records')?.addEventListener('click',event=>{
    const link=event.target.closest('a.record-link');
    if(link && link.hash===location.hash && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey){event.preventDefault();openLinkedMatch();}
  });
  $('previous').addEventListener('click',()=>{page--;history();});$('next').addEventListener('click',()=>{page++;history();});render();openLinkedMatch();
  loadItemNames().then(names=>{
    itemNames=names;
    [...new Set(Object.values(names))].sort().forEach(name=>{
      const option=document.createElement('option');option.value=name;$('item-options').append(option);
    });
    $('item-hint').textContent='Type an item name or choose a suggestion. Searches items equipped at the end of a game. Item IDs also work.';
    // Preserve the current history page and any expanded match when names arrive.
    const currentPage=page, opened=[...$('matches').querySelectorAll('details[open]')].map(el=>el.id);
    render();page=currentPage;history();
    opened.forEach(id=>{const el=document.getElementById(id);if(el) el.open=true;});
  }).catch(()=>{$('item-hint').textContent='Item names are temporarily unavailable. You can still search by item ID.';});
}
main().catch(e=>{$('status').hidden=false;$('status').textContent=e.message;});
