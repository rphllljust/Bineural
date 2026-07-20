import type { DocumentLike, MediaDevicesLike, NavigatorWithOptionalFeatures, ServiceWorkerContainerLike, ServiceWorkerLike, ServiceWorkerRegistrationLike, WakeLockManagerLike, WakeLockSentinelLike, WindowLike } from "../../src/lifecycle/types.js";

class ListenerStore {
  private readonly listeners=new Map<string,Set<EventListener>>();
  add(type:string,listener:EventListener):void{const set=this.listeners.get(type)??new Set<EventListener>();set.add(listener);this.listeners.set(type,set);}
  remove(type:string,listener:EventListener):void{this.listeners.get(type)?.delete(listener);}
  emit(type:string):void{for(const listener of this.listeners.get(type)??[])listener(new Event(type));}
  count(type:string):number{return this.listeners.get(type)?.size??0;}
}

export class MockDocument implements DocumentLike {
  visibilityState:DocumentVisibilityState="visible"; readonly store=new ListenerStore();
  addEventListener(type:string,listener:EventListener):void{this.store.add(type,listener);}
  removeEventListener(type:string,listener:EventListener):void{this.store.remove(type,listener);}
  setVisibility(state:DocumentVisibilityState):void{this.visibilityState=state;this.store.emit("visibilitychange");}
}
export class MockStorage implements Storage {
  private readonly data=new Map<string,string>(); get length():number{return this.data.size;} clear():void{this.data.clear();} getItem(key:string):string|null{return this.data.get(key)??null;} key(index:number):string|null{return[...this.data.keys()][index]??null;} removeItem(key:string):void{this.data.delete(key);} setItem(key:string,value:string):void{this.data.set(key,value);}
}
export class MockWakeLockSentinel implements WakeLockSentinelLike {
  released=false; private readonly listeners=new Set<()=>void>();
  async release():Promise<void>{this.released=true;for(const listener of this.listeners)listener();}
  addEventListener(_type:"release",listener:()=>void):void{this.listeners.add(listener);}
  removeEventListener(_type:"release",listener:()=>void):void{this.listeners.delete(listener);}
}
export class MockWakeLockManager implements WakeLockManagerLike {
  requests=0; failure:unknown|undefined; readonly sentinels:MockWakeLockSentinel[]=[];
  async request(_type:"screen"):Promise<WakeLockSentinelLike>{this.requests+=1;if(this.failure!==undefined)throw this.failure;const sentinel=new MockWakeLockSentinel();this.sentinels.push(sentinel);return sentinel;}
}
export class MockMediaDevices implements MediaDevicesLike {
  readonly store=new ListenerStore(); addEventListener(type:"devicechange",listener:()=>void):void{this.store.add(type,listener as EventListener);} removeEventListener(type:"devicechange",listener:()=>void):void{this.store.remove(type,listener as EventListener);} emitDeviceChange():void{this.store.emit("devicechange");}
}
export class MockServiceWorker implements ServiceWorkerLike {
  state:ServiceWorkerState="installing"; readonly messages:Readonly<Record<string,string>>[]=[]; private readonly listeners=new Set<()=>void>();
  postMessage(message:Readonly<Record<string,string>>):void{this.messages.push(message);} addEventListener(_type:"statechange",listener:()=>void):void{this.listeners.add(listener);} removeEventListener(_type:"statechange",listener:()=>void):void{this.listeners.delete(listener);} setState(state:ServiceWorkerState):void{this.state=state;for(const listener of this.listeners)listener();}
}
export class MockServiceWorkerRegistration implements ServiceWorkerRegistrationLike {
  waiting:ServiceWorkerLike|null=null; installing:ServiceWorkerLike|null=null; updates=0; private readonly listeners=new Set<()=>void>();
  addEventListener(_type:"updatefound",listener:()=>void):void{this.listeners.add(listener);} removeEventListener(_type:"updatefound",listener:()=>void):void{this.listeners.delete(listener);} async update():Promise<void>{this.updates+=1;} emitUpdateFound():void{for(const listener of this.listeners)listener();}
}
export class MockServiceWorkerContainer implements ServiceWorkerContainerLike {
  controller:ServiceWorkerLike|null=new MockServiceWorker(); readonly registration=new MockServiceWorkerRegistration(); readonly ready:Promise<ServiceWorkerRegistrationLike>=Promise.resolve(this.registration); registrations=0; private readonly listeners=new Set<()=>void>();
  async register(_scriptURL:string,_options?:RegistrationOptions):Promise<ServiceWorkerRegistrationLike>{this.registrations+=1;return this.registration;} addEventListener(_type:"controllerchange",listener:()=>void):void{this.listeners.add(listener);} removeEventListener(_type:"controllerchange",listener:()=>void):void{this.listeners.delete(listener);} emitControllerChange():void{for(const listener of this.listeners)listener();}
}
export class MockWindow implements WindowLike {
  readonly document=new MockDocument(); readonly sessionStorage=new MockStorage(); readonly location={reload:()=>{this.reloads+=1;}}; readonly wakeLock=new MockWakeLockManager(); readonly mediaDevices=new MockMediaDevices(); readonly serviceWorker=new MockServiceWorkerContainer(); readonly navigator:NavigatorWithOptionalFeatures={onLine:true,wakeLock:this.wakeLock,mediaDevices:this.mediaDevices,serviceWorker:this.serviceWorker}; readonly store=new ListenerStore(); reloads=0; focused=true;
  addEventListener(type:string,listener:EventListener):void{this.store.add(type,listener);} removeEventListener(type:string,listener:EventListener):void{this.store.remove(type,listener);} requestAnimationFrame(callback:FrameRequestCallback):number{callback(0);return 1;} cancelAnimationFrame(_handle:number):void{} hasFocus():boolean{return this.focused;} emit(type:string):void{this.store.emit(type);}
}
