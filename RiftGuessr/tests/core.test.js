import test from 'node:test';
import assert from 'node:assert/strict';
import {DIFFICULTIES,createSpotPool,createScene,scoreGuess,zoomAt,screenToMap,emptyBook,parseBook,recordRun,overallBest} from '../core.js';

const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const run=(id,difficulty,points=3000)=>({id,difficulty,score:points*5,rounds:Array(5).fill(points),date:'2026-11-13T23:00:00Z'});

test('all three levels retain their distinct tight crops',()=>{
 const old={easy:.17,normal:.105,hard:.065};
 for(const [key,mode] of Object.entries(DIFFICULTIES))assert.ok(mode.crop<old[key]*.5);
 assert.ok(DIFFICULTIES.easy.crop>DIFFICULTIES.normal.crop&&DIFFICULTIES.normal.crop>DIFFICULTIES.hard.crop);
});
test('five random clues remain inside the map, separated, and reproducible with the same seed',()=>{
 for(const difficulty of Object.keys(DIFFICULTIES)){
  const random=rng(8712),again=rng(8712),points=[],copies=[];
  for(let i=0;i<5;i++){
   const scene=createScene(difficulty,points,random),copy=createScene(difficulty,copies,again);
   assert.deepEqual(scene,copy);
   assert.ok(scene.x>=scene.crop/2&&scene.x<=1-scene.crop/2&&scene.y>=scene.crop/2&&scene.y<=1-scene.crop/2);
   assert.ok(points.every(p=>Math.hypot(p.x-scene.x,p.y-scene.y)>=.18));
   assert.deepEqual(Object.keys(scene).sort(),['crop','x','y']);
   points.push(scene);copies.push(copy);
  }
 }
});
test('a degenerate random source cannot hang location generation',()=>{
 const scene=createScene('hard',[{x:.5,y:.5}],()=>.5);assert.equal(scene.x,.5);
 assert.throws(()=>createScene('unknown'));
});
test('precise guesses earn more than broad guesses and rectangular image coordinates score consistently',()=>{
 assert.equal(scoreGuess({x:.5,y:.5},{x:.5,y:.5}).points,5000);
 const close=scoreGuess({x:.51,y:.5},{x:.5,y:.5});
 const farther=scoreGuess({x:.55,y:.5},{x:.5,y:.5});
 const far=scoreGuess({x:.9,y:.5},{x:.5,y:.5});
 assert.ok(close.points>farther.points&&farther.points>far.points&&far.points<1000);
 assert.equal(scoreGuess({x:.5,y:.6},{x:.5,y:.5},2).points,farther.points);
 assert.throws(()=>scoreGuess({x:NaN,y:.5},{x:.5,y:.5}));
});
test('thousands of jittered terrain regions include lanes, bases and the outer map',()=>{
 const spots=createSpotPool();assert.equal(spots.length,12000);
 assert.ok(spots.some(p=>p.x<.1)&&spots.some(p=>p.x>.9)&&spots.some(p=>p.y<.1)&&spots.some(p=>p.y>.9));
 const selected=createSpotPool({accept:(x,y)=>x>.8&&y<.2});assert.ok(selected.length>0&&selected.every(p=>p.x>.8&&p.y<.2));
 const random=rng(1421),scenes=Array.from({length:1000},()=>createScene('hard',[],random,{spots,aspect:11537/9544}));
 assert.ok(scenes.some(p=>p.x<.1)&&scenes.some(p=>p.x>.9)&&scenes.some(p=>p.y<.1)&&scenes.some(p=>p.y>.9));
 assert.ok(scenes.every(p=>p.x>=.015&&p.x<=.985&&p.y>=.02*11537/9544/2&&p.y<=1-.02*11537/9544/2));
 assert.ok(new Set(scenes.map(p=>p.x.toFixed(6)+','+p.y.toFixed(6))).size>990);
});
test('all difficulties generously reward close guesses and use the same accuracy curve',()=>{
 const answer={x:.5,y:.5};
 for(const key of Object.keys(DIFFICULTIES)){
  assert.equal(scoreGuess({x:.51,y:.5},answer,1,key).points,5000);
  assert.ok(scoreGuess({x:.511,y:.5},answer,1,key).points<5000);
  assert.ok(scoreGuess({x:.55,y:.5},answer,1,key).points>4000);
  assert.ok(scoreGuess({x:.6,y:.5},answer,1,key).points>3100);
  assert.ok(scoreGuess({x:.7,y:.5},answer,1,key).points>1900);
 }
 assert.throws(()=>scoreGuess(answer,answer,1,'invalid'));
});
test('zooming preserves the location under the cursor and screen coordinates invert the transform',()=>{
 const view={zoom:2,x:-120,y:-90},anchor={x:170,y:130};
 const before=screenToMap(anchor,view,490,410);
 const next=zoomAt(view,3,anchor,490,410),after=screenToMap(anchor,next,490,410);
 assert.ok(Math.abs(before.x-after.x)<1e-10&&Math.abs(before.y-after.y)<1e-10);
 const point={x:.42,y:.68};
 const screen={x:point.x*490*next.zoom+next.x,y:point.y*410*next.zoom+next.y};
 const roundtrip=screenToMap(screen,next,490,410);
 assert.ok(Math.abs(point.x-roundtrip.x)<1e-10&&Math.abs(point.y-roundtrip.y)<1e-10);
});
test('zoom has no game-imposed upper limit while map edges and nonfinite inputs stay safe',()=>{
 for(const scale of [.01,1,2,6,100,1000,1e8]){
  const view=zoomAt({zoom:1,x:0,y:0},scale,{x:10000,y:-10000},300,250);
  assert.equal(view.zoom,Math.max(1,scale));
  assert.ok(view.x<=0&&view.x>=300*(1-view.zoom));assert.ok(view.y<=0&&view.y>=250*(1-view.zoom));
 }
 const current={zoom:100,x:-100,y:-100};
 assert.deepEqual(zoomAt(current,Infinity,{x:100,y:100},300,250),current);
 assert.deepEqual(zoomAt(current,NaN,{x:100,y:100},300,250),current);
 assert.deepEqual(screenToMap({x:-100,y:300},{zoom:1,x:0,y:0},200,200),{x:0,y:1});
});
test('old overall highscores survive migration without inventing a difficulty',()=>{
 const book=parseBook(null,'19876');assert.equal(overallBest(book),19876);
 assert.deepEqual(book.best,{easy:0,normal:0,hard:0});
 assert.equal(overallBest(parseBook('{bad json','19876')),19876);
});
test('highscores are separate per difficulty and a lower run never replaces a best',()=>{
 let book=recordRun(emptyBook(),run('a','normal',4000));
 book=recordRun(book,run('b','normal',1000));book=recordRun(book,run('c','hard',3000));
 assert.deepEqual(book.best,{easy:0,normal:20000,hard:15000});assert.equal(overallBest(book),20000);
 assert.deepEqual(parseBook(JSON.stringify(book)),book);
});
test('recording the same completed game twice does not duplicate it',()=>{
 const result=run('same','easy'),book=recordRun(emptyBook(),result);
 assert.equal(recordRun(book,result),book);assert.equal(book.recent.length,1);
});
test('recent history is bounded while old highscores remain',()=>{
 let book=recordRun(emptyBook(),run('best','hard',5000));
 for(let i=0;i<30;i++)book=recordRun(book,run('later'+i,'hard',1000));
 assert.equal(book.recent.length,20);assert.equal(book.best.hard,25000);
 assert.equal(parseBook(JSON.stringify(book)).best.hard,25000);
});
test('partial or corrupted runs cannot become a highscore',()=>{
 for(const bad of [{...run('a','easy'),rounds:[5000]},{...run('b','hard'),score:25000},{...run('c','easy'),difficulty:'<script>'},{...run('d','easy'),date:'invalid'},{...run('e','normal'),rounds:[NaN,0,0,0,0]}])assert.throws(()=>recordRun(emptyBook(),bad));
 const book=parseBook(JSON.stringify({version:2,best:{easy:999999,normal:'500',hard:-1},recent:[{id:'wrong',score:25000}]}));
 assert.deepEqual(book,emptyBook());
});
