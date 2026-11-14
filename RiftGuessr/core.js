export const ROUNDS=5;
export const MAX_SCORE=25000;
export const SCORE_KEY='riftguessr-scores-v2';
export const DIFFICULTIES=Object.freeze({
 easy:{label:'Easy',crop:.08,timeLimit:20},
 normal:{label:'Normal',crop:.04,timeLimit:13},
 hard:{label:'Hard',crop:.02,timeLimit:8}
});
export const SCORE_RULES=Object.freeze({perfectRadius:.01,decay:5});
export const SPOT_COLUMNS=120,SPOT_ROWS=100;
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const validScore=n=>Number.isInteger(n)&&n>=0&&n<=MAX_SCORE;
export function createSpotPool({columns=SPOT_COLUMNS,rows=SPOT_ROWS,accept=()=>true}={}){
 const spots=[];
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const point={x:(x+.5)/columns,y:(y+.5)/rows};
  if(accept(point.x,point.y))spots.push(point);
 }
 return spots;
}
export function createScene(difficulty,previous=[],random=Math.random,options={}){
 const mode=DIFFICULTIES[difficulty];if(!mode)throw Error('Unknown difficulty');
 const aspect=options.aspect||1,marginX=mode.crop/2+.005,marginY=Math.min(.45,mode.crop*aspect/2+.005);
 const spots=(options.spots||[]).filter(p=>p.x>=marginX&&p.x<=1-marginX&&p.y>=marginY&&p.y<=1-marginY);
 let point,bestPoint,bestDistance=-1;
 for(let i=0;i<100;i++){
  if(spots.length){
   const candidate=spots[Math.min(spots.length-1,Math.floor(random()*spots.length))];
   point={x:clamp(candidate.x+(random()-.5)*.8/SPOT_COLUMNS,marginX,1-marginX),y:clamp(candidate.y+(random()-.5)*.8/SPOT_ROWS,marginY,1-marginY)};
  }else point={x:marginX+random()*(1-2*marginX),y:marginY+random()*(1-2*marginY)};
  const distance=previous.length?Math.min(...previous.map(p=>Math.hypot(p.x-point.x,p.y-point.y))):1;
  if(distance>bestDistance){bestPoint=point;bestDistance=distance;}
  if(distance>=.18)break;
 }
 return {...bestPoint,crop:mode.crop};
}
export function scoreGuess(guess,answer,mapAspect=1,difficulty='normal'){
 if(![guess?.x,guess?.y,answer?.x,answer?.y,mapAspect].every(Number.isFinite)||mapAspect<=0)throw Error('Invalid location');
 if(!DIFFICULTIES[difficulty])throw Error('Unknown difficulty');
 const distance=Math.hypot(guess.x-answer.x,(guess.y-answer.y)/mapAspect);
 return {distance,points:distance<=SCORE_RULES.perfectRadius+Number.EPSILON*8?5000:clamp(Math.round(5000*Math.exp(-SCORE_RULES.decay*(distance-SCORE_RULES.perfectRadius))),0,4999)};
}
export function zoomAt(view,next,anchor,width,height){
 if(!Number.isFinite(next))return {...view};
 const zoom=Math.max(1,next);
 if(!Number.isFinite(width*zoom)||!Number.isFinite(height*zoom))return {...view};
 const x=clamp(anchor.x-(anchor.x-view.x)*zoom/view.zoom,width*(1-zoom),0),y=clamp(anchor.y-(anchor.y-view.y)*zoom/view.zoom,height*(1-zoom),0);
 return Number.isFinite(x)&&Number.isFinite(y)?{zoom,x,y}:{...view};
}
export function screenToMap(point,view,width,height){
 return {x:clamp((point.x-view.x)/(width*view.zoom),0,1),y:clamp((point.y-view.y)/(height*view.zoom),0,1)};
}
export const emptyBook=()=>({version:2,best:{easy:0,normal:0,hard:0},recent:[],legacyBest:0});
export function parseBook(raw,legacy=0){
 const book=emptyBook();book.legacyBest=validScore(Number(legacy))?Number(legacy):0;
 try{
  const data=JSON.parse(raw);if(data?.version!==2)return book;
  for(const key of Object.keys(DIFFICULTIES))if(validScore(data.best?.[key]))book.best[key]=data.best[key];
  if(validScore(data.legacyBest))book.legacyBest=Math.max(book.legacyBest,data.legacyBest);
  book.recent=(Array.isArray(data.recent)?data.recent:[]).filter(r=>typeof r?.id==='string'&&r.id.length<100&&Object.hasOwn(DIFFICULTIES,r.difficulty)&&validScore(r.score)&&typeof r.date==='string'&&Number.isFinite(Date.parse(r.date))&&Array.isArray(r.rounds)&&r.rounds.length===ROUNDS&&r.rounds.every(n=>Number.isInteger(n)&&n>=0&&n<=5000)&&r.rounds.reduce((a,b)=>a+b,0)===r.score).slice(0,20).map(r=>({id:r.id,difficulty:r.difficulty,score:r.score,date:r.date,rounds:[...r.rounds]}));
  for(const run of book.recent)book.best[run.difficulty]=Math.max(book.best[run.difficulty],run.score);
 }catch{}
 return book;
}
export function recordRun(book,run){
 const verified=parseBook(JSON.stringify({...emptyBook(),recent:[run]})).recent[0];
 if(!verified)throw Error('Invalid completed run');
 if(book.recent.some(r=>r.id===verified.id))return book;
 return {...book,best:{...book.best,[run.difficulty]:Math.max(book.best[run.difficulty],run.score)},recent:[verified,...book.recent].slice(0,20)};
}
export const overallBest=book=>Math.max(book.legacyBest,...Object.values(book.best));
