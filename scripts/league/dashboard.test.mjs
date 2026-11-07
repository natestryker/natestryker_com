import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as stats from '../../assets/league/stats.mjs';
import {loadDashboardData} from '../../assets/league/data.mjs';
import {INDEX_COLUMNS} from '../../assets/league/schema.mjs';

// A small DOM harness checks shared page wiring; this is not a browser layout test.
async function renderPage(file,{search='',hash='',champions=['Zoe'],matchStats=()=>({}),optimized=false}={}){
  const html=await readFile(new URL(`../../${file}`,import.meta.url),'utf8');
  const ids=new Map();
  class Element {
    constructor(){this.children=[];this.listeners={};this.value='';this.open=false;this.isConnected=true;this._html='';}
    set innerHTML(value){this._html=value;this.children=[];}
    get innerHTML(){return this._html;}
    append(...elements){this.children.push(...elements);}
    replaceChildren(){this.children.forEach(el=>el.isConnected=false);this.children=[];}
    insertAdjacentHTML(_,html){this._html+=html;}
    addEventListener(type,handler){this.listeners[type]=handler;}
    setAttribute(name,value){this[name]=value;}
    querySelectorAll(){return [];}
    querySelector(){return {focus(){}};}
    scrollIntoView(){this.scrolled=true;}
  }
  for(const [,id] of html.matchAll(/\bid="([^"]+)"/g)) ids.set(id,new Element());
  const accounts=['main','alt','third'].map(id=>({id,label:id,updatedAt:'2026-11-07T12:00:00Z',profile:{riotId:`${id}#NA1`},ranked:[{at:'2026-11-07T12:00:00Z',entries:[{queueType:'RANKED_FLEX_SR',tier:'SILVER',rank:'II',leaguePoints:20,wins:2,losses:3},{queueType:'RANKED_SOLO_5x5',tier:'GOLD',rank:'I',leaguePoints:50,wins:1,losses:1}]}],mastery:[]}));
  const matches=Array.from({length:45},(_,i)=>({id:`NA1_${i}`,recordId:`main--NA1_${i}`,accountId:'main',accountName:'main#NA1',date:1794052800000-i*1000,queue:420,champion:champions[i%champions.length],kills:2,deaths:1,assists:3,kda:5,csPerMinute:7,damage:1000,duration:1200,items:[],win:true,...matchStats(i)}));
  const document={body:{dataset:{view:file==='match-history.html'?'history':''}},createElement:()=>new Element(),getElementById(id){
    if(ids.has(id)) return ids.get(id);
    // Match details are generated through innerHTML in the real browser.
    if(id.startsWith('match-') && ids.get('matches').innerHTML.includes(`id="${id}"`)){
      const element=new Element();ids.set(id,element);return element;
    }
    return null;
  }};
  const listeners={},location={search,hash};
  const fetcher=async url=>({ok:true,json:async()=>{
    if(!optimized)return {accounts,matches,ranked:[],mastery:[],updatedAt:'2026-11-07T12:00:00Z'};
    if(url.endsWith('public.json'))return {schemaVersion:2,accounts,matchCount:matches.length,backfillComplete:false,indexes:[{url:'views/index-2026-11-abcd.json',count:matches.length}],updatedAt:'2026-11-07T12:00:00Z'};
    return {schemaVersion:2,columns:INDEX_COLUMNS,rows:matches.map(m=>INDEX_COLUMNS.map(key=>m[key]??null))};
  }});
  const context=vm.createContext({...stats,document,location,URLSearchParams,console,matchMedia:()=>({matches:true}),window:{addEventListener:(type,handler)=>{listeners[type]=handler;}},fetch:fetcher,loadDashboardData:()=>loadDashboardData(fetcher),loadItemNames:async()=>({3020:"Sorcerer's Shoes"})});
  let script=await readFile(new URL('../../assets/league/dashboard.js',import.meta.url),'utf8');
  script=script.replace(/^import .*;\r?\n/gm,'').replace(/main\(\)\.catch[\s\S]*$/,'');
  vm.runInContext(script,context);
  await vm.runInContext('main()',context);
  await new Promise(resolve=>setImmediate(resolve));
  return {ids,listeners,location};
}
test('tracker links to history with filters and gives each account a persistent ranked arrow',async()=>{
  const {ids}=await renderPage('league.html');
  assert.equal(ids.get('rank-graph').children.length,3);
  const graph=ids.get('rank-graph').children[0];
  assert.equal(graph.className,'rank-account');assert.equal(graph.open,false);
  graph.open=true;graph.listeners.toggle();
  ids.get('champion-search').value='Zoe';ids.get('champion-search').listeners.input();
  assert.equal(ids.get('rank-graph').children[0].open,true);
  assert.equal(ids.get('history-link').href,'match-history.html?champion-search=Zoe');
  assert.equal((ids.get('matches').innerHTML.match(/<details class="match"/g)||[]).length,20);
});
test('history-only page supports filters, larger pagination and deep links without dashboard elements',async()=>{
  const {ids}=await renderPage('match-history.html',{search:'?champion-search=Zoe',hash:'#match-main--NA1_44'});
  assert.equal(ids.has('rank-graph'),false);assert.equal(ids.has('records'),false);
  assert.equal(ids.get('champion-search').value,'Zoe');
  assert.equal(ids.get('page').textContent,'2 / 2');
  assert.equal(ids.get('match-main--NA1_44').open,true);
  ids.get('previous').listeners.click();
  assert.equal((ids.get('matches').innerHTML.match(/<details class="match"/g)||[]).length,40);
  ids.get('champion-search').value='Ahri';ids.get('champion-search').listeners.input();
  assert.equal(ids.get('match-count').textContent,'0 matching matches');
});
test('champion table starts with the top five and expands without resetting match history',async()=>{
  const {ids}=await renderPage('league.html',{champions:['Zoe','Ahri','Lux','Annie','Vex','Orianna','Syndra','Neeko']});
  const rows=()=>ids.get('champions').innerHTML.split('<tbody>')[1].split('</tbody>')[0].match(/<tr>/g)?.length || 0;
  assert.equal(rows(),5);
  assert.match(ids.get('champion-count').textContent,/Top 5 of 8/);
  assert.equal(ids.get('champions-toggle').hidden,false);
  assert.equal(ids.get('champions-toggle')['aria-expanded'],'false');
  ids.get('next').listeners.click();assert.equal(ids.get('page').textContent,'2 / 3');
  ids.get('champions-toggle').listeners.click();
  assert.equal(rows(),8);assert.equal(ids.get('champions-toggle')['aria-expanded'],'true');
  assert.equal(ids.get('page').textContent,'2 / 3');
  ids.get('champions-toggle').listeners.click();assert.equal(rows(),5);
  ids.get('champion-search').value='Zoe';ids.get('champion-search').listeners.input();
  assert.equal(rows(),1);assert.equal(ids.get('champions-toggle').hidden,true);
});
test('every account shows Solo/Duo before Flex with the timestamp below its rank rows',async()=>{
  const {ids}=await renderPage('league.html');
  assert.equal(ids.get('ranked').children.length,3);
  for(const panel of ids.get('ranked').children){
    assert.equal(panel.className,'ranked-profile');
    assert.ok(panel.innerHTML.indexOf('</h3>')<panel.innerHTML.indexOf('Solo/Duo'));
    assert.ok(panel.innerHTML.indexOf('Solo/Duo')<panel.innerHTML.indexOf('Flex'));
    assert.ok(panel.innerHTML.indexOf('Flex')<panel.innerHTML.indexOf('Last updated'));
  }
});
test('every champion column sorts both ways using numeric values and retains sorting after filtering',async()=>{
  const {ids}=await renderPage('league.html',{
    champions:['Zoe','Ahri','Lux','Annie','Vex','Orianna','Syndra','Neeko'],
    matchStats:i=>({win:i%3!==0,kills:(i+1)*2,deaths:i%4+1,assists:i%7+1,damage:(45-i)*850,csPerMinute:(i%13)+1})
  });
  ids.get('champions-toggle').listeners.click();
  ids.get('next').listeners.click();
  const columns=['name','games','wins','losses','winRate','kda','cs','damage'];
  for(const [column,key] of columns.entries()){
    for(let repeat=0;repeat<2;repeat++){
      ids.get('champions').listeners.click({target:{closest:()=>({dataset:{sort:key}})}});
      const html=ids.get('champions').innerHTML;
      const direction=html.match(new RegExp(`<th scope="col" aria-sort="(ascending|descending)"><button[^>]*data-sort="${key}"`))[1];
      const rows=[...html.split('<tbody>')[1].split('</tbody>')[0].matchAll(/<tr>(.*?)<\/tr>/g)].map(row=>[...row[1].matchAll(/<td>(.*?)<\/td>/g)].map(cell=>cell[1]));
      const values=rows.map(row=>column===0?row[column]:Number(row[column].replace(/[,%]/g,'')));
      for(let i=1;i<values.length;i++){
        const difference=column===0?values[i-1].localeCompare(values[i]):values[i-1]-values[i];
        assert.ok(direction==='ascending'?difference<=0:difference>=0,`${key} ${direction}`);
      }
      assert.equal(ids.get('page').textContent,'2 / 3');
    }
  }
  ids.get('champion-search').value='Zoe';ids.get('champion-search').listeners.input();
  assert.match(ids.get('champion-count').textContent,/Avg damage/);
});
test('both pages initialize, search and calculate records using the optimized manifest and indexes',async()=>{
  for(const file of ['league.html','match-history.html']){
    const {ids}=await renderPage(file,{optimized:true});
    assert.equal(ids.get('match-count').textContent,'45 matching matches');
    assert.match(ids.get('status').textContent,/Partial collected history/);
    if(file==='league.html'){assert.match(ids.get('summary').innerHTML,/Collected games/);assert.match(ids.get('records').innerHTML,/View match/);}
    ids.get('champion-search').value='Ahri';ids.get('champion-search').listeners.input();
    assert.equal(ids.get('match-count').textContent,'0 matching matches');
  }
});
