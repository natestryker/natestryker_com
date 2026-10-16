/* Small synthesized crafting sounds; no downloads, autoplay, or audio assets. */
(()=>{'use strict';let context=null,enabled=true,volume=.45;try{const saved=JSON.parse(localStorage.getItem('riftcraft-audio'));if(saved){enabled=saved.enabled!==false;volume=Number.isFinite(saved.volume)?Math.max(0,Math.min(1,saved.volume)):.45}}catch{}
function save(){try{localStorage.setItem('riftcraft-audio',JSON.stringify({enabled,volume}))}catch{}}
function play({firstPair=false,discovery=false,mutation=false,legendary=false}={}){if(!enabled||!volume)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context??=new Audio();if(context.state==='suspended')context.resume().catch(()=>{});const now=context.currentTime+.015;
 const master=context.createGain();master.gain.value=volume*.20;master.connect(context.destination);
 function tone(freq,delay,duration,level=1,type='sine',end=freq){const osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,now+delay);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+delay+duration);gain.gain.setValueAtTime(0,now+delay);gain.gain.linearRampToValueAtTime(level,now+delay+.012);gain.gain.exponentialRampToValueAtTime(.001,now+delay+duration);osc.connect(gain);gain.connect(master);osc.start(now+delay);osc.stop(now+delay+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect()}}
 if(legendary){tone(65.41,0,.8,.55,'sine',49);tone(130.81,.04,.8,.25,'triangle');[196,261.63,329.63,392,523.25].forEach((f,i)=>tone(f,.15+i*.12,.8,.20,'triangle'));tone(783.99,.85,.85,.09);setTimeout(()=>master.disconnect(),2100);return}
 if(mutation){tone(110,0,.42,.50,'sine',55);tone(164.81,.035,.36,.25,'triangle',220);tone(220,.12,.40,.24,'triangle',329.63);tone(329.63,.23,.42,.18);tone(440,.34,.40,.13);tone(554.37,.43,.35,.10);setTimeout(()=>master.disconnect(),1200);return}
 // Low resonant body and a short wooden knock replace the glassy sparkle.
 // Keep the output gain below the previous mix; weight comes from spectrum.
 tone(155,0,.22,.65,'sine',72);tone(310,.008,.105,.22,'triangle',185);
 tone(92,.012,.28,.18,'sine',82);
 if(firstPair){tone(220,.05,.32,.29,'triangle');tone(277.18,.105,.34,.25);tone(329.63,.16,.38,.23)}else tone(196,.04,.17,.18,'triangle',164.81);
 if(discovery){tone(440,.20,.42,.20,'triangle');tone(659.25,.26,.34,.10)}
 setTimeout(()=>master.disconnect(),1100);
 }catch{/* Audio must never interrupt crafting. */}}
window.CRAFT_AUDIO={play,get enabled(){return enabled},get volume(){return volume},toggle(){enabled=!enabled;save();return enabled},setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));save()}};
})();
