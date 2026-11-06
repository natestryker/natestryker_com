import * as THREE from './vendor/three.module.js';
// Focus-scoped flight controls, shared by GPU and compatibility renderers.
export class FreeCamera {
  constructor(canvas,camera,onChange,onExit){
    this.canvas=canvas;this.camera=camera;this.onChange=onChange;this.onExit=onExit;this.keys=new Set();this.active=false;this.speed=20;
    canvas.tabIndex=0;canvas.setAttribute('aria-label','3D viewer. Free camera: WASD move, Q and E down and up, drag to look, Shift faster, Escape exit.');
    canvas.addEventListener('keydown',e=>{if(!this.active)return;if(e.code==='Escape'){this.onExit();return}if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();this.keys.add(e.code)}});
    canvas.addEventListener('keyup',e=>this.keys.delete(e.code));canvas.addEventListener('blur',()=>this.keys.clear());
    document.addEventListener('visibilitychange',()=>this.keys.clear());
    canvas.addEventListener('pointerdown',e=>{if(!this.active)return;canvas.focus({preventScroll:true});this.drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});
    canvas.addEventListener('pointermove',e=>{if(!this.active||!this.drag)return;const dx=e.clientX-this.drag[0],dy=e.clientY-this.drag[1];this.drag=[e.clientX,e.clientY];const rot=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');rot.y-=dx*.004;rot.x=Math.max(-1.55,Math.min(1.55,rot.x-dy*.004));camera.quaternion.setFromEuler(rot);camera.updateMatrixWorld();this.onChange()});
    for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>this.drag=null);
  }
  setActive(value){this.active=value;this.keys.clear();this.drag=null;if(value)this.canvas.focus({preventScroll:true})}
  update(dt){if(!this.active||!this.keys.size||!this.canvas.offsetWidth)return false;const v=new THREE.Vector3((this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0),0,(this.keys.has('KeyS')?1:0)-(this.keys.has('KeyW')?1:0));v.applyQuaternion(this.camera.quaternion);v.y+=(this.keys.has('KeyE')?1:0)-(this.keys.has('KeyQ')?1:0);if(!v.lengthSq())return false;v.normalize().multiplyScalar(this.speed*Math.min(.05,dt)*(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?3:1));this.camera.position.add(v);this.camera.updateMatrixWorld();this.onChange();return true}
}
