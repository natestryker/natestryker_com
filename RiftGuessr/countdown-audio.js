// Unlock from the Start button so browser autoplay rules allow the later warning.
export class CountdownAudio{
 constructor({createContext=()=>{const Context=globalThis.AudioContext||globalThis.webkitAudioContext;return Context?new Context():null;}}={}){
  this.createContext=createContext;this.context=null;this.active=null;
 }
 unlock(){
  try{
   if(!this.context||this.context.state==='closed')this.context=this.createContext();
   if(this.context&&this.context.state!=='running')this.context.resume()?.catch(()=>{});
  }catch{/* Audio is optional; a blocked or unsupported device must not interrupt play. */}
 }
 play(){
  const context=this.context;
  // Never queue a warning to play later when a suspended context resumes.
  if(context?.state!=='running')return;
  this.stop();
  try{
   const tone=context.createOscillator(),volume=context.createGain(),at=context.currentTime;
   this.active={tone,volume};tone.type='sine';
   tone.frequency.setValueAtTime(880,at);tone.frequency.setValueAtTime(1174.66,at+.18);
   volume.gain.setValueAtTime(0,at);
   volume.gain.linearRampToValueAtTime(.14,at+.01);
   volume.gain.exponentialRampToValueAtTime(.001,at+.12);
   volume.gain.setValueAtTime(0,at+.13);
   volume.gain.setValueAtTime(0,at+.18);
   volume.gain.linearRampToValueAtTime(.14,at+.19);
   volume.gain.exponentialRampToValueAtTime(.001,at+.39);
   volume.gain.linearRampToValueAtTime(0,at+.4);
   tone.connect(volume);volume.connect(context.destination);
   tone.onended=()=>this.stop();tone.start(at);tone.stop(at+.41);
  }catch{this.stop();}
 }
 stop(){
  const active=this.active;this.active=null;
  if(!active)return;
  active.tone.onended=null;
  try{active.tone.stop();}catch{/* The tone may already have ended. */}
  active.tone.disconnect();active.volume.disconnect();
 }
}
