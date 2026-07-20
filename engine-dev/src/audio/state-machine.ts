import { AudioEngineError } from "./errors.js";
import type { AudioEngineState, NativeContextState } from "./types.js";

const ALLOWED_TRANSITIONS: Readonly<Record<AudioEngineState, readonly AudioEngineState[]>> = Object.freeze({
  uninitialized: ["idle", "error", "disposed"],
  idle: ["starting", "error", "disposed"],
  starting: ["running", "stopping", "interaction-required", "error"],
  running: ["pausing", "stopping", "interrupted", "error"],
  pausing: ["paused", "stopping", "error"],
  paused: ["resuming", "stopping", "error", "disposed"],
  resuming: ["running", "stopping", "interrupted", "interaction-required", "error"],
  stopping: ["idle", "error", "disposed"],
  interrupted: ["recovering", "interaction-required", "stopping", "error"],
  recovering: ["running", "interaction-required", "stopping", "error"],
  "interaction-required": ["recovering", "starting", "idle", "stopping", "error", "disposed"],
  error: ["idle", "starting", "disposed"],
  disposed: []
});

export function assertTransition(
  current: AudioEngineState,
  next: AudioEngineState,
  operation: string,
  contextState?: NativeContextState
): void {
  if (current === next) return;
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new AudioEngineError(
      "INVALID_STATE_TRANSITION",
      `Transição inválida: ${current} → ${next} durante ${operation}.`,
      {
        operation,
        state: current,
        ...(contextState === undefined ? {} : { contextState }),
        details: { next }
      }
    );
  }
}
