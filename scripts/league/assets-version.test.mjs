import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {versionTrackerAssets} from '../version-tracker-assets.mjs';
test('built tracker pages and module imports get matching versions that change with CSS or JavaScript',async()=>{
 const root=await mkdtemp(join(tmpdir(),'league-asset-version-'));
 try{
   await mkdir(join(root,'assets/league'),{recursive:true});
   await writeFile(join(root,'assets/league/dashboard.js'),"import {x} from './stats.mjs'; console.log(x);\n");
   await writeFile(join(root,'assets/league/stats.mjs'),'export const x=1;\n');
   await writeFile(join(root,'assets/league/league.css'),'.pager{display:flex}\n');
   for(const directory of ['league','match-history'])await mkdir(join(root,directory),{recursive:true});
   for(const file of ['league/index.html','match-history/index.html'])await writeFile(join(root,file),'<link href="assets/league/league.css"><script type="module" src="assets/league/dashboard.js?v=old"></script>');
   const first=await versionTrackerAssets(root);
   for(const file of ['league/index.html','match-history/index.html']){
     const html=await readFile(join(root,file),'utf8');
     assert.ok(html.includes(`league.css?v=${first}`));assert.ok(html.includes(`dashboard.js?v=${first}`));
   }
   assert.ok((await readFile(join(root,'assets/league/dashboard.js'),'utf8')).includes(`./stats.mjs?v=${first}`));
   assert.equal(await versionTrackerAssets(root),first,'Stamping the same build should be stable');
   await writeFile(join(root,'assets/league/league.css'),'.pager{display:grid}\n');
   const second=await versionTrackerAssets(root);assert.notEqual(second,first);
   await writeFile(join(root,'assets/league/stats.mjs'),'export const x=2;\n');
   assert.notEqual(await versionTrackerAssets(root),second);
 }finally{await rm(root,{recursive:true,force:true});}
});
