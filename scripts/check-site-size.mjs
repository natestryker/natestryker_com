import {readdir,stat} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
const root=resolve(process.argv[2] || '_site'),files=[];
async function scan(directory){
  const entries=await readdir(directory,{withFileTypes:true});
  for(const entry of entries){
    const path=join(directory,entry.name);
    if(entry.isSymbolicLink())throw new Error('Pages artifact must not contain symbolic links');
    if(entry.isDirectory())await scan(path);
    else if(entry.isFile()){
      files.push({path:relative(root,path).replaceAll('\\','/'),bytes:(await stat(path)).size});
    }
  }
}
await scan(root);
if(files.some(file=>/^data\/league\/(?:accounts\/[^/]+\/)?matches\//.test(file.path)))throw new Error('Raw match archives must stay in Git, outside the Pages artifact.');
const bytes=files.reduce((sum,file)=>sum+file.bytes,0);
console.log(`Pages artifact: ${files.length} files, ${(bytes/1e6).toFixed(2)} MB. Largest files:`);
for(const file of files.sort((a,b)=>b.bytes-a.bytes).slice(0,8))console.log(`  ${(file.bytes/1e6).toFixed(2)} MB ${file.path}`);
if(bytes>500e6)console.warn('::warning::Pages artifact exceeds 500 MB; review archive views and media growth.');
if(bytes>1e9)throw new Error('Pages artifact exceeds the documented 1 GB site limit.');
