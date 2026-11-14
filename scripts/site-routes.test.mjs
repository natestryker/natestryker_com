import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=new URL('../',import.meta.url),origin='https://natestryker.com';
const redirects={
 'about.html':'/about/','archive.html':'/archive/','bracket_maker.html':'/bracket-maker/',
 'creations.html':'/creations/','games.html':'/games/','league.html':'/league/',
 'match-history.html':'/match-history/','secret.html':'/secret/',
 'creations/lol-lab.html':'/creations/lol-lab/',
 'creations/riftcraft.html':'/creations/riftcraft/',
 'creations/sidestep-school.html':'/creations/sidestep-school/'
};
const pages=['/',...Object.values(redirects),'/games/lol-lab/','/games/riftcraft/','/games/sidestep-school/','/RiftGuessr/','/Under-the-Rift/dist/','/Image-to-Minecraft-Converter/dist/'];
const read=path=>readFile(new URL(path.replace(/^\//,''),root),'utf8');

test('all clean routes have their own entry page, canonical URL and index normalization',async()=>{
 for(const route of pages){const html=await read(route+'index.html');
  assert.ok(html.includes(`rel="canonical" href="${origin}${route}"`),route);
  assert.ok(html.includes('src="/assets/clean-urls.js"'),route);
  assert.doesNotMatch(html,/<base\b/i,'Fragment links must stay on the current page');
 }
});

test('legacy HTML addresses redirect to the clean page while preserving filters and fragments',async()=>{
 for(const [file,route] of Object.entries(redirects)){
  const html=await read(file),source=html.match(/<script>([\s\S]*?)<\/script>/)[1];let target;
  vm.runInNewContext(source,{location:{search:'?champion-search=Zoe&account=main',hash:'#match-main--NA1_44',replace:url=>target=url}});
  assert.equal(target,route+'?champion-search=Zoe&account=main#match-main--NA1_44',file);
  assert.ok(html.includes(`href="${route}"`),'A usable fallback link is required');
 }
});

test('index.html normalization keeps query, hash and history state without reloading',async()=>{
 const source=await read('assets/clean-urls.js');
 for(const path of ['/index.html','/RiftGuessr/index.html','/Under-the-Rift/dist/index.html','/about/index.html']){
  const state={saved:true},calls=[];
  vm.runInNewContext(source,{location:{protocol:'https:',pathname:path,search:'?mode=hard',hash:'#round-2'},history:{state,replaceState:(...args)=>calls.push(args)}});
  assert.equal(calls.length,1);assert.equal(calls[0][0],state);assert.equal(calls[0][2],path.slice(0,-10)+'?mode=hard#round-2');
 }
 for(const [protocol,pathname] of [['https:','/about/'],['https:','/'],['file:','/index.html']]){
  vm.runInNewContext(source,{location:{protocol,pathname},history:{replaceState:()=>assert.fail('An already-clean or local-file URL must stay unchanged')}});
 }
});

test('page navigation and embedded games use clean URLs and every local resource resolves',async()=>{
 for(const route of pages){const html=await read(route+'index.html');
  for(const [,attribute,,value] of html.matchAll(/\b(href|src|poster|action|data-src)\s*=\s*(["'])(.*?)\2/g)){
   if(!value||value.startsWith('#')||/^(?:data:|blob:|mailto:|tel:|javascript:)/i.test(value))continue;
   const url=new URL(value,origin+route);if(url.origin!==origin)continue;
   if(attribute==='href'||url.pathname.includes('/games/'))assert.ok(!url.pathname.endsWith('.html'),`${route}: ${value}`);
   const file=new URL(url.pathname.slice(1)+(url.pathname.endsWith('/')?'index.html':''),root);
   assert.ok((await stat(file)).isFile(),`${route}: missing ${fileURLToPath(file)}`);
  }
 }
});

test('tracker fetches and generated item icons resolve from nested pages',async()=>{
 const {loadDashboardData}=await import('../assets/league/data.mjs');
 const {loadItemManifest,itemIcon}=await import('../assets/league/items.mjs');
 await loadDashboardData(async path=>{assert.equal(path,'/data/league/public.json');return Response.json({accounts:[],matches:[]});});
 const manifest=await loadItemManifest(async path=>{assert.equal(path,'/assets/league/item-catalog.json');return Response.json({names:{3020:"Sorcerer's Shoes"}});});
 assert.match(itemIcon(3020,manifest.items),/src="\/assets\/league\/items\/3020\.png"/);
});

test('publishing triggers and asset versioning include the new page directories',async()=>{
 const workflow=await read('.github/workflows/league.yml');
 for(const path of ['about','archive','bracket-maker','league','match-history','secret','RiftGuessr'])assert.ok(workflow.includes(`'${path}/**'`),path);
 assert.ok(workflow.includes('scripts/site-routes.test.mjs'));
 const versioner=await read('scripts/version-tracker-assets.mjs');
 assert.ok(versioner.includes("'league/index.html'"));assert.ok(versioner.includes("'match-history/index.html'"));
});
