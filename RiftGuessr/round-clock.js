// Absolute deadlines keep rounds accurate when browser callbacks are throttled.
export class RoundClock{
 constructor({onTick=()=>{},onExpire=()=>{},now=()=>performance.now(),schedule=(callback,delay)=>setTimeout(callback,delay),cancel=handle=>clearTimeout(handle)}={}){
  this.onTick=onTick;this.onExpire=onExpire;this.now=now;this.schedule=schedule;this.cancel=cancel;
  this.running=false;this.handle=null;this.version=0;this.lastSeconds=null;
 }
 start(seconds){
  if(!Number.isFinite(seconds)||seconds<=0)throw Error('Round duration must be positive');
  this.stop();this.deadline=this.now()+seconds*1000;this.running=true;this.lastSeconds=null;this.update();
 }
 stop(){
  if(this.handle!==null)this.cancel(this.handle);
  this.handle=null;this.running=false;this.version++;
 }
 check(){
  if(!this.running||this.now()<this.deadline)return false;
  this.expire();return true;
 }
 refresh(){
  if(!this.running)return;
  if(this.handle!==null)this.cancel(this.handle);
  this.handle=null;this.version++;this.update();
 }
 expire(){
  if(!this.running)return;
  this.stop();
  if(this.lastSeconds!==0){this.lastSeconds=0;this.onTick(0);}
  this.onExpire();
 }
 update(){
  if(!this.running)return;
  const remaining=Math.max(0,this.deadline-this.now()),seconds=Math.ceil(remaining/1000);
  if(seconds!==this.lastSeconds){this.lastSeconds=seconds;this.onTick(seconds);}
  if(!this.running)return;
  if(remaining===0){this.expire();return;}
  const version=this.version;
  this.handle=this.schedule(()=>{if(version!==this.version)return;this.handle=null;this.update();},Math.min(100,remaining));
 }
}
