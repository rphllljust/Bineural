import { AudioEngine } from "./audio-engine.js";
import { BrowserAudioContextFactory, browserMonotonicClock } from "./web-audio-adapter.js";

let engine: AudioEngine | undefined;

export function getAudioEngine(): AudioEngine {
  engine ??= new AudioEngine({
    contextFactory: new BrowserAudioContextFactory(),
    clock: browserMonotonicClock
  });
  return engine;
}

export async function disposeAudioEngine(): Promise<void> {
  if (engine === undefined) return;
  await engine.dispose();
  engine = undefined;
}
