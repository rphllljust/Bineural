import type {
  AudioContextFactory,
  AudioContextLike,
  AudioDestinationNodeLike,
  AudioNodeLike,
  AudioParamLike,
  ChannelMergerNodeLike,
  DynamicsCompressorNodeLike,
  GainNodeLike,
  MonotonicClock,
  NativeContextState,
  OscillatorNodeLike,
  OscillatorWaveform
} from "../../src/audio/types.js";

export interface AutomationCall {
  readonly method: "cancel" | "hold" | "set" | "linear" | "target";
  readonly value?: number;
  readonly time: number;
  readonly extra?: number;
}

export class MockAudioParam implements AudioParamLike {
  value: number;
  readonly calls: AutomationCall[] = [];

  constructor(initialValue = 0) { this.value = initialValue; }
  cancelScheduledValues(cancelTime: number): AudioParamLike { this.calls.push({ method:"cancel", time:cancelTime }); return this; }
  cancelAndHoldAtTime(cancelTime: number): AudioParamLike { this.calls.push({ method:"hold", time:cancelTime, value:this.value }); return this; }
  setValueAtTime(value: number, startTime: number): AudioParamLike { this.value=value; this.calls.push({ method:"set", value, time:startTime }); return this; }
  linearRampToValueAtTime(value: number, endTime: number): AudioParamLike { this.value=value; this.calls.push({ method:"linear", value, time:endTime }); return this; }
  setTargetAtTime(target: number, startTime: number, timeConstant: number): AudioParamLike { this.value=target; this.calls.push({ method:"target", value:target, time:startTime, extra:timeConstant }); return this; }
}

export interface ConnectionRecord { readonly destination: MockAudioNode; readonly output?: number; readonly input?: number; }

export class MockAudioNode implements AudioNodeLike {
  readonly connections: ConnectionRecord[] = [];
  disconnected = false;
  connect(destination: AudioNodeLike, output?: number, input?: number): AudioNodeLike { this.connections.push({ destination:destination as MockAudioNode, ...(output===undefined?{}:{output}), ...(input===undefined?{}:{input}) }); return destination; }
  disconnect(): void { this.disconnected = true; }
}

export class MockOscillatorNode extends MockAudioNode implements OscillatorNodeLike {
  readonly frequency = new MockAudioParam();
  type: OscillatorWaveform = "sine";
  onended: (() => void) | null = null;
  startedAt: number | undefined;
  stoppedAt: number | undefined;
  ended = false;
  start(when=0): void { this.startedAt=when; }
  stop(when=0): void { this.stoppedAt=when; }
  triggerEnded(): void { if(this.ended)return; this.ended=true; this.onended?.(); }
}

export class MockGainNode extends MockAudioNode implements GainNodeLike { readonly gain = new MockAudioParam(); }
export class MockChannelMergerNode extends MockAudioNode implements ChannelMergerNodeLike { constructor(readonly inputs:number){super();} }
export class MockDynamicsCompressorNode extends MockAudioNode implements DynamicsCompressorNodeLike { readonly threshold=new MockAudioParam(); readonly knee=new MockAudioParam(); readonly ratio=new MockAudioParam(); readonly attack=new MockAudioParam(); readonly release=new MockAudioParam(); }
export class MockDestinationNode extends MockAudioNode implements AudioDestinationNodeLike {}

export class MockAudioContext implements AudioContextLike {
  readonly destination = new MockDestinationNode();
  currentTime = 0;
  state: NativeContextState = "suspended";
  onstatechange: (() => void) | null = null;
  readonly oscillators: MockOscillatorNode[] = [];
  readonly gains: MockGainNode[] = [];
  readonly mergers: MockChannelMergerNode[] = [];
  readonly compressors: MockDynamicsCompressorNode[] = [];
  resumeFailure: unknown | undefined; suspendFailure: unknown | undefined; closeFailure: unknown | undefined;
  resumeCalls=0; suspendCalls=0; closeCalls=0;
  createOscillator(): OscillatorNodeLike { const node=new MockOscillatorNode(); this.oscillators.push(node); return node; }
  createGain(): GainNodeLike { const node=new MockGainNode(); this.gains.push(node); return node; }
  createChannelMerger(numberOfInputs=6): ChannelMergerNodeLike { const node=new MockChannelMergerNode(numberOfInputs); this.mergers.push(node); return node; }
  createDynamicsCompressor(): DynamicsCompressorNodeLike { const node=new MockDynamicsCompressorNode(); this.compressors.push(node); return node; }
  async resume(): Promise<void> { this.resumeCalls+=1; if(this.resumeFailure!==undefined)throw this.resumeFailure; this.state="running"; this.onstatechange?.(); }
  async suspend(): Promise<void> { this.suspendCalls+=1; if(this.suspendFailure!==undefined)throw this.suspendFailure; this.state="suspended"; this.onstatechange?.(); }
  async close(): Promise<void> { this.closeCalls+=1; if(this.closeFailure!==undefined)throw this.closeFailure; this.state="closed"; this.onstatechange?.(); }
  advance(seconds:number):void { if(this.state==="running")this.currentTime+=seconds; for(const oscillator of this.oscillators){if(oscillator.stoppedAt!==undefined&&oscillator.stoppedAt<=this.currentTime)oscillator.triggerEnded();} }
  externalSuspend():void{this.state="suspended";this.onstatechange?.();}
  externalResume():void{this.state="running";this.onstatechange?.();}
  externalClose():void{this.state="closed";this.onstatechange?.();}
}

export class MockAudioContextFactory implements AudioContextFactory {
  readonly contexts: MockAudioContext[]=[];
  creationFailure: unknown|undefined;
  create():AudioContextLike{if(this.creationFailure!==undefined)throw this.creationFailure;const context=new MockAudioContext();this.contexts.push(context);return context;}
  latest():MockAudioContext{const context=this.contexts.at(-1);if(context===undefined)throw new Error("Nenhum contexto criado.");return context;}
}

export class MockClock implements MonotonicClock {
  private time=0; private nextId=1; private readonly callbacks=new Map<number,()=>void>();
  now():number{return this.time;}
  setInterval(callback:()=>void,_milliseconds:number):number{const id=this.nextId++;this.callbacks.set(id,callback);return id;}
  clearInterval(id:number):void{this.callbacks.delete(id);}
  tick(milliseconds=250):void{this.time+=milliseconds;for(const callback of this.callbacks.values())callback();}
  activeIntervals():number{return this.callbacks.size;}
}
