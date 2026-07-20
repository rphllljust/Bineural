export type AudioEngineState =
  | "uninitialized"
  | "idle"
  | "starting"
  | "running"
  | "pausing"
  | "paused"
  | "resuming"
  | "stopping"
  | "interrupted"
  | "recovering"
  | "interaction-required"
  | "error"
  | "disposed";

export type PauseReason = "none" | "manual" | "external";
export type AudioChannel = "left" | "right";
export type OscillatorWaveform = "sine";
export type NativeContextState = "suspended" | "running" | "closed" | "interrupted";

export interface AudioParamLike {
  value: number;
  cancelScheduledValues(cancelTime: number): AudioParamLike;
  cancelAndHoldAtTime?(cancelTime: number): AudioParamLike;
  setValueAtTime(value: number, startTime: number): AudioParamLike;
  linearRampToValueAtTime(value: number, endTime: number): AudioParamLike;
  setTargetAtTime(target: number, startTime: number, timeConstant: number): AudioParamLike;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike, output?: number, input?: number): AudioNodeLike;
  disconnect(): void;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  frequency: AudioParamLike;
  type: OscillatorWaveform;
  onended: (() => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface ChannelMergerNodeLike extends AudioNodeLike {}

export interface DynamicsCompressorNodeLike extends AudioNodeLike {
  threshold: AudioParamLike;
  knee: AudioParamLike;
  ratio: AudioParamLike;
  attack: AudioParamLike;
  release: AudioParamLike;
}

export interface AudioDestinationNodeLike extends AudioNodeLike {}

export interface AudioContextLike {
  readonly destination: AudioDestinationNodeLike;
  readonly currentTime: number;
  readonly state: NativeContextState;
  onstatechange: (() => void) | null;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
  createChannelMerger(numberOfInputs?: number): ChannelMergerNodeLike;
  createDynamicsCompressor(): DynamicsCompressorNodeLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

export interface AudioContextFactory {
  create(): AudioContextLike;
}

export interface MonotonicClock {
  now(): number;
  setInterval(callback: () => void, milliseconds: number): number;
  clearInterval(id: number): void;
}

export interface SafetyLimits {
  readonly minCarrierHz: number;
  readonly maxCarrierHz: number;
  readonly minBinauralHz: number;
  readonly maxBinauralHz: number;
  readonly minChannelHz: number;
  readonly maxChannelHz: number;
  readonly minMasterVolume: number;
  readonly maxMasterVolume: number;
  readonly minChannelVolume: number;
  readonly maxChannelVolume: number;
  readonly minFadeSeconds: number;
  readonly maxFadeSeconds: number;
  readonly minTransitionSeconds: number;
  readonly maxTransitionSeconds: number;
  readonly minDurationSeconds: number;
  readonly maxDurationSeconds: number;
}

export interface SafetyConfiguration {
  readonly maxMasterVolume: number;
  readonly requireFadeIn: boolean;
  readonly requireFadeOut: boolean;
  readonly limiterEnabled: true;
}

export interface CommonSessionConfiguration {
  readonly waveform?: OscillatorWaveform;
  readonly masterVolume?: number;
  readonly leftVolume?: number;
  readonly rightVolume?: number;
  readonly durationSeconds?: number;
  readonly fadeInSeconds?: number;
  readonly fadeOutSeconds?: number;
  readonly transitionSeconds?: number;
  readonly safety?: Partial<SafetyConfiguration>;
}

export interface CarrierOffsetConfiguration extends CommonSessionConfiguration {
  readonly mode: "carrier-offset";
  readonly carrierHz: number;
  readonly binauralHz: number;
}

export interface DirectChannelConfiguration extends CommonSessionConfiguration {
  readonly mode: "direct";
  readonly leftHz: number;
  readonly rightHz: number;
}

export type BinauralSessionConfiguration = CarrierOffsetConfiguration | DirectChannelConfiguration;

export interface ResolvedSessionConfiguration {
  readonly mode: "carrier-offset" | "direct";
  readonly carrierHz: number;
  readonly binauralHz: number;
  readonly leftHz: number;
  readonly rightHz: number;
  readonly waveform: OscillatorWaveform;
  readonly masterVolume: number;
  readonly leftVolume: number;
  readonly rightVolume: number;
  readonly durationSeconds?: number;
  readonly fadeInSeconds: number;
  readonly fadeOutSeconds: number;
  readonly transitionSeconds: number;
  readonly safety: SafetyConfiguration;
}

export type AudioEngineErrorCode =
  | "AUDIO_API_UNAVAILABLE"
  | "INVALID_CONFIGURATION"
  | "INVALID_STATE_TRANSITION"
  | "START_FAILED"
  | "SUSPEND_FAILED"
  | "RESUME_FAILED"
  | "CONTEXT_CLOSED"
  | "ENGINE_DISPOSED"
  | "NODE_CREATION_FAILED"
  | "INTERACTION_REQUIRED"
  | "RECOVERY_FAILED";

export interface AudioEngineErrorContext {
  readonly operation: string;
  readonly state: AudioEngineState;
  readonly contextState?: NativeContextState;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export type AudioEngineEvent =
  | { readonly type: "statechange"; readonly previous: AudioEngineState; readonly current: AudioEngineState }
  | { readonly type: "sessionstart"; readonly configuration: ResolvedSessionConfiguration }
  | { readonly type: "pause"; readonly reason: PauseReason }
  | { readonly type: "resume"; readonly reason: PauseReason }
  | { readonly type: "stop"; readonly automatic: boolean }
  | { readonly type: "configurationchange"; readonly configuration: ResolvedSessionConfiguration }
  | { readonly type: "progress"; readonly elapsedSeconds: number; readonly remainingSeconds?: number }
  | { readonly type: "autostop" }
  | { readonly type: "externalsuspension"; readonly contextState: NativeContextState }
  | { readonly type: "recovered" }
  | { readonly type: "interactionrequired"; readonly message: string }
  | { readonly type: "error"; readonly error: import("./errors.js").AudioEngineError };

export type AudioEngineListener = (event: AudioEngineEvent) => void;

export interface AudioEngineSnapshot {
  readonly state: AudioEngineState;
  readonly contextState: NativeContextState | "absent";
  readonly pauseReason: PauseReason;
  readonly requiresUserGesture: boolean;
  readonly desiredPlayback: boolean;
  readonly configuration?: ResolvedSessionConfiguration;
  readonly elapsedSeconds: number;
  readonly remainingSeconds?: number;
  readonly graphActive: boolean;
}

export interface AudioEngineOptions {
  readonly contextFactory: AudioContextFactory;
  readonly clock: MonotonicClock;
  readonly limits?: Partial<SafetyLimits>;
  readonly progressIntervalMilliseconds?: number;
  readonly recoveryFadeSeconds?: number;
}
