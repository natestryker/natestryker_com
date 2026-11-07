// Optional local browser QA. Uses an installed Chrome; no packages or API credentials required.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,extname,relative,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const root=resolve('.'),profile=await mkdtemp(join(tmpdir(),'league-browser-'));
const requests=[],pending=new Map();let browser,socket,serial=0;
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!path.startsWith(root+sep))throw new Error('Invalid path');
    const body=await readFile(path);
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(path)] || 'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
function command(method,params={}){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const value=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw new Error(JSON.stringify(value.exceptionDetails));return value.result.value;}
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await wait(100);}throw new Error(`Browser wait expired: ${expression}`);}
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
  await command('Page.navigate',{url:`${url}/league.html`});
  await until("document.querySelectorAll('#champions tbody tr').length===5 && document.querySelectorAll('#matches > details').length>0");
  assert.equal(await evaluate("document.getElementById('ranked').children.length"),3);
  assert.ok(!requests.some(url=>url.includes('/matches/') || url.includes('/views/details/')));
  assert.ok(!requests.some(url=>url.includes('/ranked.json')));
  await evaluate("document.getElementById('matches').scrollIntoView({behavior:'instant'})");
  const sidebar=await evaluate("({top:document.querySelector('.tracker-search').getBoundingClientRect().top,bottom:document.querySelector('.tracker-search').getBoundingClientRect().bottom,height:innerHeight})");
  assert.ok(sidebar.top>=0 && sidebar.bottom<=sidebar.height,JSON.stringify(sidebar));
  await evaluate("document.querySelector('#matches > details').open=true");
  await until("document.querySelector('#matches > details .match-details')!==null");
  assert.equal(requests.filter(url=>url.includes('/views/details/')).length,1);
  assert.ok(!requests.some(url=>url.includes('/matches/')));
  await evaluate("document.querySelector('#rank-graph > details').open=true");
  await until("document.querySelector('#rank-graph > details svg')!==null");
  await wait(300);assert.ok(requests.some(url=>url.includes('/ranked.json')));
  await evaluate("document.querySelector('button[data-sort=damage]').click();document.getElementById('champions-toggle').click()");
  assert.ok(await evaluate("document.querySelectorAll('#champions tbody tr').length>5"));
  assert.equal(await evaluate("document.querySelector('button[data-sort=damage]').closest('th').getAttribute('aria-sort')"),'descending');
  await command('Page.navigate',{url:`${url}/match-history.html?champion-search=Zoe`});
  await until("document.querySelectorAll('#matches > details').length>0");
  assert.equal(await evaluate("document.getElementById('champion-search').value"),'Zoe');
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await command('Page.navigate',{url:`${url}/league.html`});
  await until("document.querySelectorAll('#matches > details').length>0");
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  console.log('Chrome QA passed: desktop/mobile rendering, sticky sidebar, champion sorting/expansion, filtered history, lazy match details and ranked history.');
}finally{
  if(socket?.readyState===1){try{await command('Browser.close');}catch{}socket.close();}
  browser?.kill();await new Promise(r=>server.close(r));
  const safe=relative(resolve(tmpdir()),resolve(profile));
  if(!safe || safe.startsWith('..') || resolve(profile)===resolve(tmpdir()))throw new Error('Unsafe temporary profile path');
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
