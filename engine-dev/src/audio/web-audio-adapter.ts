import { AudioEngineError } from "./errors.js";
import type { AudioContextFactory, AudioContextLike, MonotonicClock } from "./types.js";

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export class BrowserAudioContextFactory implements AudioContextFactory {
  create(): AudioContextLike {
    if (typeof window === "undefined") {
      throw new AudioEngineError(
        "AUDIO_API_UNAVAILABLE",
        "Window indisponível para criar AudioContext.",
        { operation: "create-context", state: "uninitialized" }
      );
    }
    const browserWindow = window as WindowWithWebkitAudioContext;
    const Constructor = window.AudioContext ?? browserWindow.webkitAudioContext;
    if (Constructor === undefined) {
      throw new AudioEngineError(
        "AUDIO_API_UNAVAILABLE",
        "AudioContext não está disponível neste navegador.",
        { operation: "create-context", state: "uninitialized" }
      );
    }
    return new Constructor() as unknown as AudioContextLike;
  }
}

export const browserMonotonicClock: MonotonicClock = Object.freeze({
  now: () => performance.now(),
  setInterval: (callback: () => void, milliseconds: number) => window.setInterval(callback, milliseconds),
  clearInterval: (id: number) => window.clearInterval(id)
});
