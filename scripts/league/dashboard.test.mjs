import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as stats from '../../assets/league/stats.mjs';

// A small DOM harness checks shared page wiring; this is not a browser layout test.
async function renderPage(file,{search='',hash=''}={}){
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
    querySelectorAll(){return [];}
    querySelector(){return {focus(){}};}
    scrollIntoView(){this.scrolled=true;}
  }
  for(const [,id] of html.matchAll(/\bid="([^"]+)"/g)) ids.set(id,new Element());
  const accounts=['main','alt','third'].map(id=>({id,label:id,updatedAt:'2026-11-07T12:00:00Z',profile:{riotId:`${id}#NA1`},ranked:[{at:'2026-11-07T12:00:00Z',entries:[{queueType:'RANKED_SOLO_5x5',tier:'GOLD',rank:'I',leaguePoints:50,wins:1,losses:1}]}],mastery:[]}));
  const matches=Array.from({length:45},(_,i)=>({id:`NA1_${i}`,recordId:`main--NA1_${i}`,accountId:'main',accountName:'main#NA1',date:1794052800000-i*1000,queue:420,champion:'Zoe',kills:2,deaths:1,assists:3,kda:5,csPerMinute:7,damage:1000,duration:1200,items:[],win:true}));
  const document={body:{dataset:{view:file==='match-history.html'?'history':''}},createElement:()=>new Element(),getElementById(id){
    if(ids.has(id)) return ids.get(id);
    // Match details are generated through innerHTML in the real browser.
    if(id.startsWith('match-') && ids.get('matches').innerHTML.includes(`id="${id}"`)){
      const element=new Element();ids.set(id,element);return element;
    }
    return null;
  }};
  const listeners={},location={search,hash};
  const context=vm.createContext({...stats,document,location,URLSearchParams,console,matchMedia:()=>({matches:true}),window:{addEventListener:(type,handler)=>{listeners[type]=handler;}},fetch:async()=>({ok:true,json:async()=>({accounts,matches,ranked:[],mastery:[],updatedAt:'2026-11-07T12:00:00Z'})}),loadItemNames:async()=>({3020:"Sorcerer's Shoes"})});
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
