import {
  DEFAULT_CHANNEL_VOLUME,
  DEFAULT_FADE_IN_SECONDS,
  DEFAULT_FADE_OUT_SECONDS,
  DEFAULT_LIMITS,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_SAFETY,
  DEFAULT_TRANSITION_SECONDS
} from "./constants.js";
import { AudioEngineError } from "./errors.js";
import type {
  AudioEngineState,
  BinauralSessionConfiguration,
  ResolvedSessionConfiguration,
  SafetyConfiguration,
  SafetyLimits
} from "./types.js";

function mergeLimits(overrides?: Partial<SafetyLimits>): SafetyLimits {
  return Object.freeze({ ...DEFAULT_LIMITS, ...overrides });
}

function assertFiniteInRange(
  label: string,
  value: number,
  min: number,
  max: number,
  state: AudioEngineState
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new AudioEngineError(
      "INVALID_CONFIGURATION",
      `${label} deve estar entre ${min} e ${max}. Recebido: ${String(value)}.`,
      { operation: "validate", state, details: { label, value, min, max } }
    );
  }
}

export function resolveSessionConfiguration(
  input: BinauralSessionConfiguration,
  state: AudioEngineState,
  limitOverrides?: Partial<SafetyLimits>
): ResolvedSessionConfiguration {
  const limits = mergeLimits(limitOverrides);
  const safety: SafetyConfiguration = Object.freeze({
    ...DEFAULT_SAFETY,
    ...input.safety
  });

  assertFiniteInRange(
    "Teto de volume",
    safety.maxMasterVolume,
    limits.minMasterVolume,
    limits.maxMasterVolume,
    state
  );

  const masterVolume = input.masterVolume ?? DEFAULT_MASTER_VOLUME;
  const leftVolume = input.leftVolume ?? DEFAULT_CHANNEL_VOLUME;
  const rightVolume = input.rightVolume ?? DEFAULT_CHANNEL_VOLUME;
  const fadeInSeconds = input.fadeInSeconds ?? DEFAULT_FADE_IN_SECONDS;
  const fadeOutSeconds = input.fadeOutSeconds ?? DEFAULT_FADE_OUT_SECONDS;
  const transitionSeconds = input.transitionSeconds ?? DEFAULT_TRANSITION_SECONDS;

  assertFiniteInRange("Volume principal", masterVolume, limits.minMasterVolume, safety.maxMasterVolume, state);
  assertFiniteInRange("Volume esquerdo", leftVolume, limits.minChannelVolume, limits.maxChannelVolume, state);
  assertFiniteInRange("Volume direito", rightVolume, limits.minChannelVolume, limits.maxChannelVolume, state);
  assertFiniteInRange("Fade-in", fadeInSeconds, limits.minFadeSeconds, limits.maxFadeSeconds, state);
  assertFiniteInRange("Fade-out", fadeOutSeconds, limits.minFadeSeconds, limits.maxFadeSeconds, state);
  assertFiniteInRange(
    "Duração da transição",
    transitionSeconds,
    limits.minTransitionSeconds,
    limits.maxTransitionSeconds,
    state
  );

  if (input.waveform !== undefined && input.waveform !== "sine") {
    throw new AudioEngineError(
      "INVALID_CONFIGURATION",
      "A ETAPA 02 aceita somente oscilador senoidal.",
      { operation: "validate", state, details: { waveform: input.waveform } }
    );
  }

  let carrierHz: number;
  let binauralHz: number;
  let leftHz: number;
  let rightHz: number;

  if (input.mode === "carrier-offset") {
    assertFiniteInRange("Frequência portadora", input.carrierHz, limits.minCarrierHz, limits.maxCarrierHz, state);
    assertFiniteInRange("Diferença binaural", input.binauralHz, limits.minBinauralHz, limits.maxBinauralHz, state);
    carrierHz = input.carrierHz;
    binauralHz = input.binauralHz;
    leftHz = carrierHz;
    rightHz = carrierHz + binauralHz;
  } else {
    assertFiniteInRange("Frequência esquerda", input.leftHz, limits.minChannelHz, limits.maxChannelHz, state);
    assertFiniteInRange("Frequência direita", input.rightHz, limits.minChannelHz, limits.maxChannelHz, state);
    leftHz = input.leftHz;
    rightHz = input.rightHz;
    binauralHz = Math.abs(rightHz - leftHz);
    assertFiniteInRange("Diferença binaural direta", binauralHz, limits.minBinauralHz, limits.maxBinauralHz, state);
    carrierHz = leftHz;
  }

  assertFiniteInRange("Frequência esquerda resolvida", leftHz, limits.minChannelHz, limits.maxChannelHz, state);
  assertFiniteInRange("Frequência direita resolvida", rightHz, limits.minChannelHz, limits.maxChannelHz, state);

  if (input.durationSeconds !== undefined) {
    assertFiniteInRange(
      "Duração",
      input.durationSeconds,
      limits.minDurationSeconds,
      limits.maxDurationSeconds,
      state
    );
    const requiredEnvelope = fadeInSeconds + fadeOutSeconds + 0.05;
    if (input.durationSeconds < requiredEnvelope) {
      throw new AudioEngineError(
        "INVALID_CONFIGURATION",
        `A duração deve ser maior que a soma dos fades (${requiredEnvelope.toFixed(2)} s).`,
        { operation: "validate", state, details: { durationSeconds: input.durationSeconds, requiredEnvelope } }
      );
    }
  }

  return Object.freeze({
    mode: input.mode,
    carrierHz,
    binauralHz,
    leftHz,
    rightHz,
    waveform: "sine",
    masterVolume,
    leftVolume,
    rightVolume,
    ...(input.durationSeconds === undefined ? {} : { durationSeconds: input.durationSeconds }),
    fadeInSeconds,
    fadeOutSeconds,
    transitionSeconds,
    safety
  });
}

export function validateMasterVolume(
  value: number,
  configuration: ResolvedSessionConfiguration,
  state: AudioEngineState,
  overrides?: Partial<SafetyLimits>
): number {
  const limits = mergeLimits(overrides);
  assertFiniteInRange("Volume principal", value, limits.minMasterVolume, configuration.safety.maxMasterVolume, state);
  return value;
}

export function validateChannelVolume(
  value: number,
  state: AudioEngineState,
  overrides?: Partial<SafetyLimits>
): number {
  const limits = mergeLimits(overrides);
  assertFiniteInRange("Volume de canal", value, limits.minChannelVolume, limits.maxChannelVolume, state);
  return value;
}

export function validateCarrierFrequency(
  value: number,
  state: AudioEngineState,
  overrides?: Partial<SafetyLimits>
): number {
  const limits = mergeLimits(overrides);
  assertFiniteInRange("Frequência portadora", value, limits.minCarrierHz, limits.maxCarrierHz, state);
  return value;
}

export function validateBinauralFrequency(
  value: number,
  state: AudioEngineState,
  overrides?: Partial<SafetyLimits>
): number {
  const limits = mergeLimits(overrides);
  assertFiniteInRange("Diferença binaural", value, limits.minBinauralHz, limits.maxBinauralHz, state);
  return value;
}

export function validateChannelFrequency(
  value: number,
  state: AudioEngineState,
  overrides?: Partial<SafetyLimits>
): number {
  const limits = mergeLimits(overrides);
  assertFiniteInRange("Frequência de canal", value, limits.minChannelHz, limits.maxChannelHz, state);
  return value;
}
