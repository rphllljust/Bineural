export { AudioEngine } from "./audio-engine.js";
export { AudioEngineError } from "./errors.js";
export { getAudioEngine, disposeAudioEngine } from "./singleton.js";
export { resolveSessionConfiguration } from "./validation.js";
export type {
  AudioChannel,
  AudioContextFactory,
  AudioContextLike,
  AudioEngineEvent,
  AudioEngineListener,
  AudioEngineOptions,
  AudioEngineSnapshot,
  AudioEngineState,
  BinauralSessionConfiguration,
  CarrierOffsetConfiguration,
  DirectChannelConfiguration,
  PauseReason,
  ResolvedSessionConfiguration
} from "./types.js";
