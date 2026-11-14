import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const imports=/(from\s*['"]|import\s*['"])(\.\/[^'"]+\.(?:mjs|js))(?:\?v=[^'"]*)?(['"])/g;
export async function versionTrackerAssets(root=process.cwd()){
  const directory=join(root,'assets/league'),sources=[];
  for(const entry of (await readdir(directory,{withFileTypes:true})).filter(e=>e.isFile()&&/\.(js|mjs|css)$/.test(e.name)).sort((a,b)=>a.name.localeCompare(b.name))){
    const source=await readFile(join(directory,entry.name),'utf8');
    sources.push({name:entry.name,source:source.replace(imports,'$1$2$3')});
  }
  const digest=createHash('sha256');for(const file of sources)digest.update(file.name+'\n'+file.source+'\n');
  const version=digest.digest('hex').slice(0,12);
  for(const file of sources){
    if(!/\.(mjs|js)$/.test(file.name))continue;
    await writeFile(join(directory,file.name),file.source.replace(imports,(_,prefix,path,quote)=>`${prefix}${path}?v=${version}${quote}`));
  }
  for(const name of ['league/index.html','match-history/index.html']){
    const file=join(root,name),html=await readFile(file,'utf8');
    await writeFile(file,html.replace(/(assets\/league\/(?:dashboard\.js|league\.css))(?:\?v=[^"']*)?/g,`$1?v=${version}`));
  }
  return version;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)versionTrackerAssets(resolve(process.argv[2]||'.')).then(v=>console.log(`Tracker asset version: ${v}`)).catch(e=>{console.error(e.message);process.exitCode=1;});
