import ko from './locales/ko.js';
let language='en';try{language=localStorage.getItem('converter-language')==='ko'?'ko':'en'}catch{}
export const getLanguage=()=>language;
const escapeRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const phrases=new RegExp('(?<![A-Za-z])(?:'+Object.keys(ko).sort((a,b)=>b.length-a.length).map(escapeRegExp).join('|')+')(?![A-Za-z])','g');
export function korean(text){
 const source=String(text),s=source.trim();if(!s)return source;
 if(ko[s])return source.replace(s,ko[s]);
 const rules=[
 [/^Step (\d+)$/,(_,n)=>`${n}단계`],
 [/^Place (\d+) × (.+)$/,(_,n,b)=>`${korean(b)} ${n}개 배치`],
 [/^Leave (\d+) empty spaces?$/,(_,n)=>`${n}칸 비워두기`],
 [/^Row (\d+) of (\d+) · Y = (\d+)$/,(_,r,h,y)=>`${r}번째 줄 / 전체 ${h}줄 · Y = ${y}`],
 [/^Chest (\d+) of (\d+)$/,(_,n,total)=>`${n}번째 상자 / 전체 ${total}개`],
 [/^(\d[\d,]*) of (\d[\d,]*) materials collected$/,(_,n,total)=>`재료 ${total}종 중 ${n}종 수집 완료`],
 [/^(\d+)% complete · ([\d,]+) \/ ([\d,]+) blocks$/,(_,n,a,b)=>`${n}% 완료 · ${a} / ${b}개 블록`],
 [/^(\d+)% complete$/,(_,n)=>`${n}% 완료`],
 [/^([\d,]+) stacks · (\d+) chests?$/,(_,n,c)=>`${n}묶음 · 상자 ${c}개`],
 [/^([\d,]+) total · (\d+) full stacks \+ (\d+)$/,(_,n,a,b)=>`총 ${n}개 · ${a}묶음 + ${b}개`],
 [/^(\d+) stacks \+ (\d+)$/,(_,a,b)=>`${a}묶음 + ${b}개`],
 [/^(\d+) full shulker boxes$/,(_,n)=>`꽉 찬 셜커 상자 ${n}개`],
 [/^(\d+) selected$/,(_,n)=>`${n}개 선택됨`],
 [/^(\d+) types$/,(_,n)=>`${n}종`],
 [/^([\d,]+) blocks?$/,(_,n)=>`${n}개 블록`],
 [/^From X (\d+) to X (\d+)(.*)$/,(_,a,b,rest)=>`X ${a}부터 X ${b}까지${korean(rest)}`],
 [/^At X (\d+)(.*)$/,(_,a,rest)=>`X ${a} 위치${korean(rest)}`],
 [/^(.+) at X (\d+)(, placed)?$/,(_,b,x,p)=>`${korean(b)} · X ${x}${p?' · 배치 완료':''}`],
 [/^(.+), (\d+) blocks(, collected)?$/,(_,b,n,c)=>`${korean(b)}, ${n}개${c?', 수집 완료':''}`],
 [/^Collected (.+)$/,(_,b)=>`${korean(b)} 수집 완료`],
 [/^Delete “(.*)” from this browser\? Download a backup first to keep it\.$/,(_,name)=>`이 브라우저에서 “${name}”을(를) 삭제할까요? 보관하려면 먼저 백업을 다운로드하세요.`],
 [/^Delete (.+)$/,(_,name)=>`${name} 삭제`],
 [/^Unable to start: (.*)$/,(_,msg)=>`시작할 수 없습니다: ${korean(msg)}`],
 ];
 for(const [re,replace]of rules)if(re.test(s))return source.replace(s,s.replace(re,replace));
 return source.replace(phrases,m=>ko[m]).replace(/\bblocks\b/g,'블록').replace(/\bblock\b/g,'블록').replace(/\bstacks\b/g,'묶음').replace(/\bmaterials\b/g,'재료').replace(/\bfacing=east\b/g,'방향=동쪽').replace(/\baxis=y\b/g,'축=Y').replace(/\bplaced\b/g,'배치 완료').replace(/\bcollected\b/g,'수집 완료');
}
export const t=text=>language==='ko'?korean(text):String(text);
export const blockSearchText=b=>`${b.name} ${b.category||''} ${korean(b.name)} ${korean(b.category||'')}`.toLowerCase();
const textState=new WeakMap(),attributeState=new WeakMap();
const skip='script,style,[data-no-i18n],textarea';
function updateText(node){const parent=node.parentElement;if(!parent||parent.closest(skip))return;let state=textState.get(node);const current=node.nodeValue;if(!state||current!==state.output)state={source:current};const output=t(state.source);state.output=output;textState.set(node,state);if(current!==output)node.nodeValue=output}
function updateAttributes(el){if(el.closest(skip))return;let states=attributeState.get(el);if(!states){states={};attributeState.set(el,states)}for(const name of ['title','aria-label','placeholder','alt']){if(!el.hasAttribute(name))continue;const current=el.getAttribute(name);let state=states[name];if(!state||current!==state.output)state={source:current};state.output=t(state.source);states[name]=state;if(current!==state.output)el.setAttribute(name,state.output)}}
let observer;
export function translateDocument(root=document.body){if(!root)return;observer?.disconnect();try{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let node=walker.nextNode();node;node=walker.nextNode())updateText(node);for(const el of root.querySelectorAll('[title],[aria-label],[placeholder],[alt]'))updateAttributes(el);document.documentElement.lang=language;document.title=t('Image to Minecraft Converter');const button=document.getElementById('languageToggle');if(button){button.textContent=language==='ko'?'English':'한국어';button.setAttribute('aria-label',language==='ko'?'Switch to English':'한국어로 전환');button.lang=language==='ko'?'en':'ko'}}finally{observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt']})}}
export function setLanguage(value){language=value==='ko'?'ko':'en';try{localStorage.setItem('converter-language',language)}catch{}translateDocument();document.dispatchEvent(new CustomEvent('languagechange',{detail:language}))}
export function initializeLanguage(){observer=new MutationObserver(()=>translateDocument());document.getElementById('languageToggle').addEventListener('click',()=>setLanguage(language==='ko'?'en':'ko'));translateDocument()}
