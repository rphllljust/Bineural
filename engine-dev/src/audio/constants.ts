import type { SafetyConfiguration, SafetyLimits } from "./types.js";

export const MIN_POSITIVE_GAIN = 0.0001;

export const DEFAULT_LIMITS: SafetyLimits = Object.freeze({
  minCarrierHz: 80,
  maxCarrierHz: 500,
  minBinauralHz: 0.5,
  maxBinauralHz: 40,
  minChannelHz: 80,
  maxChannelHz: 540,
  minMasterVolume: 0,
  maxMasterVolume: 0.3,
  minChannelVolume: 0,
  maxChannelVolume: 1,
  minFadeSeconds: 0.02,
  maxFadeSeconds: 5,
  minTransitionSeconds: 0.01,
  maxTransitionSeconds: 3,
  minDurationSeconds: 1,
  maxDurationSeconds: 14_400
});

export const DEFAULT_SAFETY: SafetyConfiguration = Object.freeze({
  maxMasterVolume: 0.3,
  requireFadeIn: true,
  requireFadeOut: true,
  limiterEnabled: true
});

export const DEFAULT_MASTER_VOLUME = 0.08;
export const DEFAULT_CHANNEL_VOLUME = 0.5;
export const DEFAULT_FADE_IN_SECONDS = 1.2;
export const DEFAULT_FADE_OUT_SECONDS = 0.35;
export const DEFAULT_TRANSITION_SECONDS = 0.08;
export const DEFAULT_RECOVERY_FADE_SECONDS = 0.6;
export const DEFAULT_PROGRESS_INTERVAL_MILLISECONDS = 250;

export const LIMITER_CONFIGURATION = Object.freeze({
  threshold: -18,
  knee: 6,
  ratio: 12,
  attack: 0.003,
  release: 0.25
});
