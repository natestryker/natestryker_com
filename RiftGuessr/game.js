import {ROUNDS,SCORE_KEY,DIFFICULTIES,clamp,createScene,scoreGuess,zoomAt,screenToMap,parseBook,recordRun,overallBest} from './core.js';
import {ClueRenderer} from './clue-renderer.js';
import {TerrainSource,ImageSource,loadImage} from './terrain-source.js';
import {RoundClock} from './round-clock.js';

const $=id=>document.getElementById(id);
const fmt=n=>n.toLocaleString('en-US');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storageOK=true;
function readBook(){try{return parseBook(localStorage.getItem(SCORE_KEY),localStorage.getItem('riftguessr-best'));}catch{storageOK=false;return parseBook(null);}}
let book=readBook(),phase='lobby',difficulty='normal',source=null,scene=null,pin=null;
let round=1,total=0,rounds=[],locations=[],gameId='',previousBest=0,runSaved=false;
let view={zoom:1,x:0,y:0},hovered=false,pinned=false,keyboardFocus=false,localURL=null;
let renderer;
let mapFrame=0,mapVersion=0,roundRequest=0;
const roundClock=new RoundClock({
 onTick:seconds=>{
  $('time-left').textContent=seconds;
  $('round-timer').setAttribute('aria-label',seconds+' seconds remaining');
  $('round-timer').classList.toggle('is-urgent',seconds<=5);
  if(seconds===5)$('game-announcement').textContent='5 seconds remaining.';
 },
 onExpire:()=>submitGuess({timedOut:true})
});
try{renderer=new ClueRenderer($('clue-canvas'));}catch{ $('load-status').textContent='Your browser could not prepare the terrain view. Try Chrome, Edge or Firefox.'; }

function showScreen(id){for(const screen of ['lobby','game-screen','results-screen'])$(screen).hidden=screen!==id;}
function storageMessage(){return storageOK?'':'Scores are kept for this visit. Browser storage is unavailable.';}
function renderScores(){
 for(const [key,mode] of Object.entries(DIFFICULTIES)){
  const hasRun=book.best[key]>0||book.recent.some(r=>r.difficulty===key);
  document.querySelector('[data-best="'+key+'"]').textContent='Best '+(hasRun?fmt(book.best[key]):'—');
 }
 $('score-bests').innerHTML=Object.entries(DIFFICULTIES).map(([key,mode])=>`<div class="score-best"><span>${mode.label}</span><strong>${book.best[key]||book.recent.some(r=>r.difficulty===key)?fmt(book.best[key]):'—'}</strong></div>`).join('');
 $('overall-best').textContent=overallBest(book)?fmt(overallBest(book)):'—';
 $('recent-runs').innerHTML=book.recent.length?book.recent.map(run=>{
  const date=new Date(run.date);
  return `<div class="recent-run"><span>${DIFFICULTIES[run.difficulty].label}</span><strong>${fmt(run.score)}</strong><time datetime="${date.toISOString()}">${esc(date.toLocaleDateString(undefined,{month:'short',day:'numeric'}))}</time></div>`;
 }).join(''):'<p class="empty-runs">Your first finished game starts the leaderboard.</p>';
 $('scores-save-status').textContent=storageMessage();
}
function openScores(){renderScores();$('scores-dialog').showModal();}
function renderDock(){
 const expanded=hovered||pinned||keyboardFocus||phase==='revealed';
 $('guess-dock').classList.toggle('is-expanded',expanded);
 $('expand-map').setAttribute('aria-expanded',String(expanded));
 $('expand-map').setAttribute('aria-label',pinned?'Release expanded map':'Keep map expanded');
}
function renderView(){
 const box=$('map-viewport').getBoundingClientRect();
 if(!box.width||!box.height)return;
 view.x=clamp(view.x,box.width*(1-view.zoom),0);view.y=clamp(view.y,box.height*(1-view.zoom),0);
 $('map-viewport').dataset.zoom=String(view.zoom);
 $('zoom-out').disabled=view.zoom<=1;
 marker('guess-marker',pin,box);marker('correct-marker',phase==='revealed'?scene:null,box);
 $('result-line').hidden=phase!=='revealed'||!pin;
 if(phase==='revealed'&&pin&&scene){
  const project=point=>({x:clamp((point.x*box.width*view.zoom+view.x)/box.width*1000,-1e6,1e6),y:clamp((point.y*box.height*view.zoom+view.y)/box.height*1000,-1e6,1e6)});
  const a=project(pin),b=project(scene);
  for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))$('distance-line').setAttribute(key,value);
 }
 const version=++mapVersion;cancelAnimationFrame(mapFrame);
 mapFrame=requestAnimationFrame(()=>{
  if(!source||$('game-screen').hidden)return;
  const canvas=$('map-canvas'),ratio=Math.min(devicePixelRatio||1,2),currentSource=source;
  canvas.width=Math.max(1,Math.round(box.width*ratio));canvas.height=Math.max(1,Math.round(box.height*ratio));
  currentSource.render(canvas.getContext('2d',{alpha:false}),{x:-view.x/(box.width*view.zoom)*source.width,y:-view.y/(box.height*view.zoom)*source.height,width:source.width/view.zoom,height:source.height/view.zoom},{isCurrent:()=>version===mapVersion&&currentSource===source});
 });
}
function resetView(){view={zoom:1,x:0,y:0};renderView();}
function zoom(next,anchor){
 const box=$('map-viewport').getBoundingClientRect();
 view=zoomAt(view,next,anchor||{x:box.width/2,y:box.height/2},box.width,box.height);renderView();
}
function marker(id,point,box=$('map-viewport').getBoundingClientRect()){
 const node=$(id);if(!point){node.hidden=true;return;}
 const x=point.x*box.width*view.zoom+view.x,y=point.y*box.height*view.zoom+view.y;
 node.hidden=!Number.isFinite(x)||!Number.isFinite(y)||x< -40||y< -40||x>box.width+40||y>box.height+40;
 if(!node.hidden){node.style.left=x+'px';node.style.top=y+'px';}
}
function clearGuess(){
 pin=null;marker('guess-marker',null);marker('correct-marker',null);
 $('result-line').hidden=true;$('clear-guess').disabled=true;$('primary-btn').disabled=true;$('primary-btn').textContent='Place your pin';
}
function makeGuess(point){
 if(phase!=='guessing'||roundClock.check())return;
 pin={x:clamp(point.x,0,1),y:clamp(point.y,0,1)};marker('guess-marker',pin);
 $('clear-guess').disabled=false;$('primary-btn').disabled=false;$('primary-btn').textContent='Lock in guess';
 $('game-announcement').textContent='Pin placed. Lock in your guess when ready.';
}
async function beginRound(){
 const request=++roundRequest;
 roundClock.stop();$('time-left').textContent='—';$('round-timer').classList.remove('is-urgent');$('round-timer').classList.add('is-stopped');
 $('round-timer').setAttribute('aria-label','Timer starts when the location is ready');
 phase='loading';scene=createScene(difficulty,locations,Math.random,{spots:source.spots,aspect:source.width/source.height});locations.push({x:scene.x,y:scene.y});
 clearGuess();$('round-result').hidden=true;$('round-readout').textContent=`Round ${round} / ${ROUNDS}`;
 $('difficulty-readout').textContent=DIFFICULTIES[difficulty].label;$('total-score').textContent=fmt(total);
 $('clue-label').textContent='Where on the Rift?';pinned=false;hovered=false;keyboardFocus=false;renderDock();resetView();
 $('clue-label').textContent='Loading location…';
 const detail=await renderer.setScene(source,scene);
 if(request!==roundRequest||$('game-screen').hidden)return;
 phase='guessing';$('clue-label').textContent=detail===false?'Showing terrain overview':'Where on the Rift?';
 $('game-announcement').textContent=`Round ${round}. Find this location on the Rift.`;
 $('round-timer').classList.remove('is-stopped');roundClock.start(DIFFICULTIES[difficulty].timeLimit);
}
function startGame(){
 if(phase!=='lobby'||!source||!renderer)return;
 difficulty=document.querySelector('[name="difficulty"]:checked').value;
 gameId=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2);
 round=1;total=0;rounds=[];locations=[];runSaved=false;previousBest=book.best[difficulty];
 showScreen('game-screen');document.activeElement?.blur();beginRound();
}
function goLobby(){
 roundClock.stop();
 roundRequest++;phase='lobby';pinned=false;hovered=false;keyboardFocus=false;showScreen('lobby');renderScores();
 $('start-game').focus();
}
function saveCompletedRun(){
 if(runSaved)return;
 // Merge another tab's completed runs before writing this one.
 const current=readBook(),combined={...book,best:{...book.best},recent:[...book.recent],legacyBest:Math.max(book.legacyBest,current.legacyBest)};
 for(const key of Object.keys(DIFFICULTIES))combined.best[key]=Math.max(combined.best[key],current.best[key]);
 for(const run of current.recent)if(!combined.recent.some(r=>r.id===run.id))combined.recent.push(run);
 combined.recent.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 book=recordRun(combined,{id:gameId,difficulty,score:total,date:new Date().toISOString(),rounds:rounds.map(r=>r.points)});
 runSaved=true;
 try{localStorage.setItem(SCORE_KEY,JSON.stringify(book));localStorage.setItem('riftguessr-best',String(overallBest(book)));storageOK=true;}catch{storageOK=false;}
 renderScores();
}
function submitGuess({timedOut=false}={}){
 if(phase!=='guessing')return;
 if(!timedOut&&(roundClock.check()||!pin))return;
 roundClock.stop();$('round-timer').classList.add('is-stopped');
 phase='revealed';
 const result=pin?scoreGuess(pin,scene,source.width/source.height,difficulty):{distance:null,points:0};total+=result.points;rounds.push(result);
 marker('correct-marker',scene);
 $('result-line').hidden=!pin;$('clear-guess').disabled=true;$('total-score').textContent=fmt(total);
 $('round-points').textContent='+'+fmt(result.points);
 $('round-rating').textContent=timedOut?(pin?'Time’s up — guess locked.':'Time’s up.'):result.points===5000?'Right on the mark.':result.points>=3500?'Great eye.':result.points>=1800?'Getting warmer.':'Another corner to learn.';
 $('round-distance').textContent=pin?(result.distance*100).toFixed(1)+'% of the map away':'No pin placed · 0 points';
 $('round-result').hidden=false;$('primary-btn').disabled=false;$('primary-btn').textContent=round===ROUNDS?'View results':'Next round';
 $('clue-label').textContent=pin?'Gold: your guess · Teal: the location':'Teal: the location';
 renderDock();resetView();
 if(round===ROUNDS)saveCompletedRun();
 $('game-announcement').textContent=`${result.points} points. ${$('round-rating').textContent}`;
}
function finishGame(){
 if(phase!=='revealed'||round!==ROUNDS)return;
 roundClock.stop();
 saveCompletedRun();phase='finished';showScreen('results-screen');
 $('results-difficulty').textContent=DIFFICULTIES[difficulty].label.toUpperCase()+' · FIVE ROUNDS';
 $('end-total').textContent=fmt(total);$('result-mode').textContent=DIFFICULTIES[difficulty].label;
 $('result-best').textContent=fmt(book.best[difficulty]);$('new-best').hidden=total<=previousBest;
 $('end-note').textContent=total>=21000?'You know the Rift by heart.':total>=15000?'There’s no hiding from your map awareness.':total>=8000?'A few more corners to learn.':'The Rift still has its secrets.';
 $('round-summary').innerHTML=rounds.map((r,i)=>`<li><span>Round ${i+1}</span><strong>${fmt(r.points)}</strong></li>`).join('');
 $('save-status').textContent=storageMessage();$('play-again').focus();
}

$('start-game').addEventListener('click',startGame);$('leave-game').addEventListener('click',goLobby);$('play-again').addEventListener('click',goLobby);
$('primary-btn').addEventListener('click',()=>{if(phase==='guessing')submitGuess();else if(phase==='revealed'){if(round===ROUNDS)finishGame();else{round++;beginRound();}}});
$('clear-guess').addEventListener('click',()=>{if(phase==='guessing'&&!roundClock.check())clearGuess();});
$('open-scores').addEventListener('click',openScores);$('results-scores').addEventListener('click',openScores);
$('open-settings').addEventListener('click',()=>$('settings-dialog').showModal());
document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$('expand-map').addEventListener('click',()=>{pinned=!pinned;renderDock();});
$('guess-dock').addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;renderDock();}});
$('guess-dock').addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){hovered=false;renderDock();}});
$('guess-dock').addEventListener('focusin',event=>{keyboardFocus=event.target.matches(':focus-visible');renderDock();});
$('guess-dock').addEventListener('focusout',()=>queueMicrotask(()=>{keyboardFocus=$('guess-dock').contains(document.activeElement)&&document.activeElement.matches(':focus-visible');renderDock();}));
for(const [id,action] of [['zoom-in',()=>zoom(view.zoom*1.4)],['zoom-out',()=>zoom(view.zoom/1.4)],['zoom-reset',resetView]])$(id).addEventListener('click',event=>{event.stopPropagation();action();});
$('map-viewport').addEventListener('wheel',event=>{
 event.preventDefault();const box=event.currentTarget.getBoundingClientRect();zoom(view.zoom*Math.exp(-event.deltaY*.002),{x:event.clientX-box.left,y:event.clientY-box.top});
},{passive:false});

const pointers=new Map();let gesture=null;
function localPoint(event){const r=$('map-viewport').getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
$('map-viewport').addEventListener('pointerdown',event=>{
 if(event.target.closest('button')||event.button!==0)return;
 const p=localPoint(event);pointers.set(event.pointerId,p);event.currentTarget.setPointerCapture(event.pointerId);
 if(pointers.size===1)gesture={start:p,view:{...view},moved:false,pinching:false};
 else if(pointers.size===2){
  const [a,b]=[...pointers.values()];gesture={view:{...view},moved:true,pinching:true,distance:Math.hypot(a.x-b.x,a.y-b.y),anchor:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
 }
});
$('map-viewport').addEventListener('pointermove',event=>{
 if(!pointers.has(event.pointerId)||!gesture)return;
 const p=localPoint(event);pointers.set(event.pointerId,p);
 const box=event.currentTarget.getBoundingClientRect();
 if(pointers.size>=2&&gesture.pinching){
  const [a,b]=[...pointers.values()],anchor={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  view=zoomAt(gesture.view,gesture.view.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,gesture.distance),gesture.anchor,box.width,box.height);
  view.x+=anchor.x-gesture.anchor.x;view.y+=anchor.y-gesture.anchor.y;renderView();return;
 }
 if(gesture.pinching)return;
 const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;
 if(Math.hypot(dx,dy)>5)gesture.moved=true;
 if(gesture.moved&&view.zoom>1){view={zoom:view.zoom,x:gesture.view.x+dx,y:gesture.view.y+dy};renderView();event.currentTarget.classList.add('is-dragging');}
});
function endPointer(event){
 if(!pointers.has(event.pointerId))return;
 const point=localPoint(event),box=$('map-viewport').getBoundingClientRect();
 if(event.type==='pointerup'&&pointers.size===1&&gesture&&!gesture.moved&&!gesture.pinching)makeGuess(screenToMap(point,view,box.width,box.height));
 pointers.delete(event.pointerId);
 if(!pointers.size){gesture=null;$('map-viewport').classList.remove('is-dragging');}
}
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('map-viewport').addEventListener(name,endPointer);
$('map-viewport').addEventListener('keydown',event=>{
 if(event.target!==event.currentTarget)return;
 keyboardFocus=true;renderDock();
 if(event.key==='+'||event.key==='='){event.preventDefault();zoom(view.zoom*1.4);return;}
 if(event.key==='-'){event.preventDefault();zoom(view.zoom/1.4);return;}
 if(event.key==='Home'){event.preventDefault();resetView();return;}
 if(phase!=='guessing'||roundClock.check())return;
 const point={...(pin||{x:.5,y:.5})},step=(event.altKey ? .001 : event.shiftKey ? .035 : .008)/view.zoom;
 if(event.key==='ArrowLeft')point.x-=step;else if(event.key==='ArrowRight')point.x+=step;
 else if(event.key==='ArrowUp')point.y-=step;else if(event.key==='ArrowDown')point.y+=step;
 else if(event.key!=='Enter'&&event.key!==' ')return;
 event.preventDefault();makeGuess(point);
 if(phase!=='guessing'||!pin)return;
 // Keep the keyboard-controlled pin in sight after moving beyond the viewport.
 const box=event.currentTarget.getBoundingClientRect();
 const px=pin.x*box.width*view.zoom+view.x,py=pin.y*box.height*view.zoom+view.y;
 if(px<15||px>box.width-15)view.x=box.width/2-pin.x*box.width*view.zoom;
 if(py<15||py>box.height-15)view.y=box.height/2-pin.y*box.height*view.zoom;
 renderView();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){pinned=false;keyboardFocus=false;document.activeElement?.blur();renderDock();}});
document.addEventListener('visibilitychange',()=>roundClock.refresh());
window.addEventListener('pageshow',()=>roundClock.refresh());
let lastSize=null;
new ResizeObserver(entries=>{
 const {width,height}=entries[0].contentRect;
 if(!width||!height)return;
 if(lastSize){view.x*=width/lastSize.width;view.y*=height/lastSize.height;}
 lastSize={width,height};renderView();
}).observe($('map-viewport'));
let resizeFrame=0;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>renderer?.draw());});

function useSource(next){
 source=next;mapVersion++;document.documentElement.style.setProperty('--map-aspect',source.width/source.height);
 $('map-source').textContent=source.label+' · '+fmt(source.width)+' × '+fmt(source.height)+' · '+fmt(source.spots.length)+' terrain regions';
 $('start-game').disabled=!renderer;$('start-game').textContent='Start game';
 if(renderer)$('load-status').textContent='';
}
async function loadMap(){
 try{useSource(await TerrainSource.load());}
 catch{
  try{useSource(new ImageSource(await loadImage('assets/rift-map.jpg'),'Classic Summoner’s Rift'));$('load-status').textContent='High-resolution terrain unavailable. Using the classic capture.';}
  catch{
   try{useSource(new ImageSource(await loadImage('assets/fallback.svg'),'Illustrated offline map'));$('load-status').textContent='Terrain capture unavailable. Playing with the illustrated map.';}
   catch{$('load-status').textContent='Map could not load. Choose a map image in Map & credits.';}
  }
 }
}
$('upload-map-btn').addEventListener('click',()=>$('upload-map').click());
$('upload-map').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 const url=URL.createObjectURL(file);
 try{
  const next=await loadImage(url);
  if(next.naturalWidth<1500||next.naturalHeight<1500)throw Error('Choose an image at least 1,500 pixels wide and high.');
  useSource(new ImageSource(next,'Custom map'));
  if(localURL)URL.revokeObjectURL(localURL);localURL=url;$('upload-status').textContent='Custom map ready for your next game.';
 }catch(error){URL.revokeObjectURL(url);$('upload-status').textContent=error.message;}
 event.target.value='';
});
renderScores();loadMap();
