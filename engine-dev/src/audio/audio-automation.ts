import { MIN_POSITIVE_GAIN } from "./constants.js";
import type { AudioParamLike } from "./types.js";

export function holdCurrentValue(param: AudioParamLike, atTime: number): number {
  const current = Number.isFinite(param.value) ? param.value : 0;
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(atTime);
  } else {
    param.cancelScheduledValues(atTime);
    param.setValueAtTime(current, atTime);
  }
  return current;
}

export function rampLinear(
  param: AudioParamLike,
  value: number,
  startTime: number,
  durationSeconds: number
): void {
  holdCurrentValue(param, startTime);
  param.linearRampToValueAtTime(value, startTime + durationSeconds);
}

export function rampToSilence(
  param: AudioParamLike,
  startTime: number,
  durationSeconds: number
): number {
  holdCurrentValue(param, startTime);
  const endTime = startTime + durationSeconds;
  param.linearRampToValueAtTime(MIN_POSITIVE_GAIN, endTime);
  return endTime;
}

export function rampFromSilence(
  param: AudioParamLike,
  target: number,
  startTime: number,
  durationSeconds: number
): void {
  param.cancelScheduledValues(startTime);
  param.setValueAtTime(MIN_POSITIVE_GAIN, startTime);
  param.linearRampToValueAtTime(target, startTime + durationSeconds);
}
