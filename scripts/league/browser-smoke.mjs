// Optional local browser QA. Uses an installed Chrome; no packages or API credentials required.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile,stat} from 'node:fs/promises';
import {resolve,join,extname,relative,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const root=resolve('.'),profile=await mkdtemp(join(tmpdir(),'league-browser-'));
const requests=[],pending=new Map();let browser,socket,serial=0;
const server=createServer(async(req,res)=>{
  try{
    const requestUrl=new URL(req.url,'http://localhost');let path=resolve(root,'.'+decodeURIComponent(requestUrl.pathname));
    if(path!==root&&!path.startsWith(root+sep))throw new Error('Invalid path');
    if((await stat(path)).isDirectory()){if(!requestUrl.pathname.endsWith('/')){res.writeHead(301,{Location:requestUrl.pathname+'/'+requestUrl.search});res.end();return;}path=join(path,'index.html');}
    const body=await readFile(path);
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.webm':'video/webm','.mp4':'video/mp4'})[extname(path)] || 'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
function command(method,params={}){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const value=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw new Error(JSON.stringify(value.exceptionDetails));return value.result.value;}
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await wait(100);}throw new Error(`Browser wait expired: ${expression}`);}
async function checkPagination(screenshot){
  const count=await evaluate("Number(document.getElementById('page-input').max)");
  assert.ok(count>1,'Real archive should have multiple pages');
  const first=await evaluate("document.querySelector('#matches > details').id");
  await evaluate("document.getElementById('last').click()");
  await until(`document.getElementById('page-input').value==='${count}'`);
  assert.equal(await evaluate("document.getElementById('last').disabled"),true);
  assert.notEqual(await evaluate("document.querySelector('#matches > details').id"),first);
  await evaluate("document.getElementById('page-input').value='2';document.getElementById('page-go').click()");
  assert.equal(await evaluate("document.getElementById('page-input').value"),'2');
  await evaluate("document.getElementById('page-input').value='1';document.getElementById('page-input').focus()");
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until("document.getElementById('page-input').value==='1' && document.getElementById('first').disabled");
  assert.equal(await evaluate("document.querySelector('#matches > details').id"),first);
  await evaluate("document.querySelector('.pager').scrollIntoView({block:'center',behavior:'instant'})");
  const bounds=await evaluate("(()=>{const r=document.querySelector('.pager-controls').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,inputWidth:document.getElementById('page-input').getBoundingClientRect().width,viewport:innerWidth};})()");
  assert.ok(bounds.width<420 && bounds.width<=bounds.viewport,bounds.width);
  assert.equal(bounds.inputWidth,46);
  if(screenshot){
    const capture=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,scale:1}});
    await writeFile(join(tmpdir(),screenshot),Buffer.from(capture.data,'base64'));
  }
  console.log(`Pagination verified: last (${count}/${count}), Go, Enter, first page; control width=${bounds.width}px.`);
}
try{
  browser=spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
  let port;
  for(let i=0;i<150;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await wait(100);}}
  if(!port)throw new Error('Chrome debugging endpoint unavailable');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Network.requestWillBeSent')requests.push(message.params.request.url);if(message.id){const p=pending.get(message.id);pending.delete(message.id);if(message.error)p.reject(new Error(message.error.message));else p.resolve(message.result);}});
  await command('Page.enable');await command('Runtime.enable');await command('Network.enable');
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await command('Page.navigate',{url:`${url}/league/`});
  await until("document.querySelectorAll('#champions tbody tr').length===5 && document.querySelectorAll('#matches > details').length>0");
  assert.equal(await evaluate("document.querySelectorAll('#matches img[data-item-icon]').length"),0);
  assert.equal(requests.filter(path=>path.includes('/assets/league/items/')).length,0);
  console.log('Initial tracker: zero item PNG downloads; compact local item catalog enabled.');
  assert.equal(await evaluate("document.getElementById('ranked').children.length"),3);
  assert.ok(!requests.some(url=>url.includes('/matches/') || url.includes('/views/details/')));
  assert.ok(!requests.some(url=>url.includes('/ranked.json')));
  await checkPagination('league-pager-desktop.png');
  await evaluate("document.getElementById('matches').scrollIntoView({behavior:'instant'})");
  const sidebar=await evaluate("({top:document.querySelector('.tracker-search').getBoundingClientRect().top,bottom:document.querySelector('.tracker-search').getBoundingClientRect().bottom,height:innerHeight})");
  assert.ok(sidebar.top>=0 && sidebar.bottom<=sidebar.height,JSON.stringify(sidebar));
  assert.ok(await evaluate("[...document.querySelectorAll('img[data-item-icon]')].every(img=>img.src.startsWith(location.origin+'/assets/league/items/'))"));
  assert.ok(!requests.some(url=>url.includes('ddragon.leagueoflegends.com') || url.includes('api.riotgames.com')));
  await evaluate("document.querySelector('#matches > details').open=true");
  await until("document.querySelector('#matches > details .match-details')!==null");
  await until("[...document.querySelector('#matches > details').querySelectorAll('img[data-item-icon]')].some(img=>img.complete && img.naturalWidth>0)");
  assert.equal(await evaluate("document.querySelectorAll('#matches > details:first-child .item-build').length"),1);
  assert.equal(await evaluate("document.querySelector('#matches > details .match-details').textContent.includes('Items:')"),false);
  assert.equal(requests.filter(url=>url.includes('/views/details/')).length,1);
  assert.ok(!requests.some(url=>url.includes('/matches/')));
  await evaluate("document.querySelector('#rank-graph > details').open=true");
  await until("document.querySelector('#rank-graph > details svg')!==null");
  await wait(300);assert.ok(requests.some(url=>url.includes('/ranked.json')));
  await evaluate("document.querySelector('button[data-sort=damage]').click();document.getElementById('champions-toggle').click()");
  assert.ok(await evaluate("document.querySelectorAll('#champions tbody tr').length>5"));
  assert.equal(await evaluate("document.querySelector('button[data-sort=damage]').closest('th').getAttribute('aria-sort')"),'descending');
  await evaluate("document.getElementById('item-search').value='sorcerer boots';document.getElementById('item-search').dispatchEvent(new Event('input'))");
  assert.equal(await evaluate("document.querySelectorAll('#item-preview').length"),0);
  assert.equal(await evaluate("document.querySelectorAll('#matches summary img[data-item-icon]').length"),0);
  await evaluate("document.querySelector('#matches > details').open=true");
  await until("document.querySelector('#matches > details .match-details')!==null");
  assert.ok(await evaluate("document.querySelector('#matches > details .item-build img[src$=\"/3020.png\"]')!==null"));
  assert.ok(await evaluate("new URL(document.getElementById('history-link').href).searchParams.get('item-search')==='sorcerer boots'"));
  await command('Page.navigate',{url:`${url}/match-history/?champion-search=Zoe`});
  await until("document.querySelectorAll('#matches > details').length>0");
  assert.equal(await evaluate("document.getElementById('champion-search').value"),'Zoe');
  await checkPagination();
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await command('Page.navigate',{url:`${url}/league/`});
  await until("document.querySelectorAll('#matches > details').length>0");
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await checkPagination('league-pager-mobile.png');
  await command('Page.navigate',{url:`${url}/`});
  await until("document.readyState==='complete'");
  assert.equal(await evaluate("document.getElementById('secret-welcome').getAttribute('src')"),null);
  assert.ok(await evaluate("!performance.getEntriesByType('resource').some(entry=>entry.name.endsWith('/YEP.png'))"));
  await command('Page.navigate',{url:`${url}/?reward-test=1#secret-welcome`});
  await until("document.getElementById('secret-welcome').naturalWidth>0");
  assert.equal(await evaluate("document.getElementById('secret-welcome').hidden"),false);
  await command('Page.navigate',{url:`${url}/games/`});
  await until("document.readyState==='complete'");
  assert.ok(await evaluate("[...document.querySelectorAll('video')].every(video=>video.preload==='none')"));
  assert.ok(await evaluate("!performance.getEntriesByType('resource').some(entry=>/\\.(mp4|webm)(?:$|[?])/.test(entry.name))"));
  console.log('Chrome QA passed: desktop/mobile rendering, sticky sidebar, champion sorting/expansion, filtered history, lazy details/ranks, local item PNGs and text item filter. No browser Riot/CDN requests.');
}finally{
  if(socket?.readyState===1){try{await command('Browser.close');}catch{}socket.close();}
  browser?.kill();await new Promise(r=>server.close(r));
  const safe=relative(resolve(tmpdir()),resolve(profile));
  if(!safe || safe.startsWith('..') || resolve(profile)===resolve(tmpdir()))throw new Error('Unsafe temporary profile path');
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
