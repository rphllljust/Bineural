import { DEFAULT_LIMITS, DEFAULT_PROGRESS_INTERVAL_MILLISECONDS, DEFAULT_RECOVERY_FADE_SECONDS, LIMITER_CONFIGURATION, MIN_POSITIVE_GAIN } from "./constants.js";
import { holdCurrentValue, rampFromSilence } from "./audio-automation.js";
import { AudioEngineError } from "./errors.js";
import { assertTransition } from "./state-machine.js";
import type { AudioContextLike, AudioEngineEvent, AudioEngineListener, AudioEngineOptions, AudioEngineSnapshot, AudioEngineState, BinauralSessionConfiguration, ChannelMergerNodeLike, DynamicsCompressorNodeLike, GainNodeLike, OscillatorNodeLike, PauseReason, ResolvedSessionConfiguration, SafetyLimits } from "./types.js";

export interface AudioGraph { leftOscillator: OscillatorNodeLike; rightOscillator: OscillatorNodeLike; leftGain: GainNodeLike; rightGain: GainNodeLike; merger: ChannelMergerNodeLike; masterGain: GainNodeLike; limiter: DynamicsCompressorNodeLike; }
export type StopKind = "none" | "manual" | "automatic";

export abstract class AudioEngineBase {
  protected state: AudioEngineState = "uninitialized";
  protected context: AudioContextLike | null = null;
  protected graph: AudioGraph | null = null;
  protected configuration?: ResolvedSessionConfiguration;
  protected pauseReason: PauseReason = "none";
  protected requiresUserGesture = false;
  protected desiredPlayback = false;
  protected readonly listeners = new Set<AudioEngineListener>();
  protected readonly limits: SafetyLimits;
  protected readonly progressMs: number;
  protected readonly recoveryFade: number;
  protected manualContextOperation = false;
  protected generation = 0;
  protected startTime: number | undefined;
  protected endTime: number | undefined;
  protected elapsed = 0;
  protected intervalId: number | undefined;
  protected ended = 0;
  protected stopKind: StopKind = "none";
  protected stopPromise: Promise<void> | undefined;
  protected resolveStop: (() => void) | undefined;

  constructor(protected readonly options: AudioEngineOptions) {
    this.limits = Object.freeze({ ...DEFAULT_LIMITS, ...options.limits });
    this.progressMs = options.progressIntervalMilliseconds ?? DEFAULT_PROGRESS_INTERVAL_MILLISECONDS;
    this.recoveryFade = options.recoveryFadeSeconds ?? DEFAULT_RECOVERY_FADE_SECONDS;
  }

  subscribe(listener: AudioEngineListener): () => void { this.assertUsable("subscribe"); this.listeners.add(listener); return () => this.listeners.delete(listener); }

  getState(): AudioEngineSnapshot {
    const elapsed = this.computeElapsed();
    const remaining = this.configuration?.durationSeconds === undefined ? undefined : Math.max(0, this.configuration.durationSeconds - elapsed);
    return Object.freeze({ state:this.state, contextState:this.context?.state ?? "absent", pauseReason:this.pauseReason, requiresUserGesture:this.requiresUserGesture, desiredPlayback:this.desiredPlayback, ...(this.configuration === undefined ? {} : { configuration:this.configuration }), elapsedSeconds:elapsed, ...(remaining === undefined ? {} : { remainingSeconds:remaining }), graphActive:this.graph !== null });
  }

  protected createGraph(c: ResolvedSessionConfiguration): AudioGraph {
    try {
      const ctx = this.requireContext("createGraph");
      const leftOscillator = ctx.createOscillator(), rightOscillator = ctx.createOscillator();
      const leftGain = ctx.createGain(), rightGain = ctx.createGain(), masterGain = ctx.createGain();
      const merger = ctx.createChannelMerger(2), limiter = ctx.createDynamicsCompressor();
      leftOscillator.type = rightOscillator.type = "sine";
      leftOscillator.frequency.setValueAtTime(c.leftHz, ctx.currentTime); rightOscillator.frequency.setValueAtTime(c.rightHz, ctx.currentTime);
      leftGain.gain.setValueAtTime(c.leftVolume, ctx.currentTime); rightGain.gain.setValueAtTime(c.rightVolume, ctx.currentTime); masterGain.gain.setValueAtTime(MIN_POSITIVE_GAIN, ctx.currentTime);
      limiter.threshold.setValueAtTime(LIMITER_CONFIGURATION.threshold, ctx.currentTime); limiter.knee.setValueAtTime(LIMITER_CONFIGURATION.knee, ctx.currentTime); limiter.ratio.setValueAtTime(LIMITER_CONFIGURATION.ratio, ctx.currentTime); limiter.attack.setValueAtTime(LIMITER_CONFIGURATION.attack, ctx.currentTime); limiter.release.setValueAtTime(LIMITER_CONFIGURATION.release, ctx.currentTime);
      leftOscillator.connect(leftGain); rightOscillator.connect(rightGain); leftGain.connect(merger,0,0); rightGain.connect(merger,0,1); merger.connect(masterGain); masterGain.connect(limiter); limiter.connect(ctx.destination);
      return { leftOscillator,rightOscillator,leftGain,rightGain,merger,masterGain,limiter };
    } catch (cause) { throw this.makeError(cause, "NODE_CREATION_FAILED", "Falha ao criar nós.", "createGraph"); }
  }

  protected scheduleAutomatic(graph: AudioGraph): void {
    if (this.endTime === undefined || this.configuration === undefined) return;
    this.stopKind = "automatic";
    const ctx = this.requireContext("schedule");
    const fadeStart = Math.max(ctx.currentTime, this.endTime - this.configuration.fadeOutSeconds);
    holdCurrentValue(graph.masterGain.gain, ctx.currentTime); graph.masterGain.gain.setValueAtTime(this.configuration.masterVolume, fadeStart); graph.masterGain.gain.linearRampToValueAtTime(MIN_POSITIVE_GAIN, this.endTime);
    graph.leftOscillator.stop(this.endTime); graph.rightOscillator.stop(this.endTime);
  }

  protected onEnded(graph: AudioGraph): void {
    if (this.graph !== graph || ++this.ended < 2) return;
    const automatic = this.stopKind === "automatic"; this.cleanup(); this.desiredPlayback = false; this.pauseReason = "none"; this.requiresUserGesture = false;
    if (this.state !== "disposed") { if (this.state !== "stopping") this.transition("stopping", "ended"); this.transition("idle", "cleaned"); }
    this.emit({ type:"stop", automatic }); if (automatic) this.emit({ type:"autostop" }); this.resolveStop?.(); this.resolveStop = undefined; this.stopPromise = undefined; this.stopKind = "none";
  }

  protected handleContextChange(): void {
    if (this.manualContextOperation || !this.context || this.state === "disposed") return;
    const contextState = this.context.state;
    if (contextState === "closed") {
      this.elapsed = this.computeElapsed(); this.cleanup(); const error = this.makeError(undefined, "CONTEXT_CLOSED", "Contexto fechado.", "statechange"); this.requiresUserGesture = true; this.desiredPlayback = true; this.enterError(error); this.emit({ type:"interactionrequired", message:error.toFriendlyMessage() }); return;
    }
    if ((contextState === "suspended" || contextState === "interrupted") && this.state === "running") { this.pauseReason = "external"; this.transition("interrupted", "external-suspend"); this.emit({ type:"externalsuspension", contextState }); this.emit({ type:"pause", reason:"external" }); return; }
    if (contextState === "running" && this.state === "interrupted") { this.transition("recovering", "external-resume"); this.recoveryRamp(); this.pauseReason = "none"; this.transition("running", "external-resume-complete"); this.emit({ type:"recovered" }); }
  }

  protected recoveryRamp(): void { if (this.graph && this.context && this.configuration) rampFromSilence(this.graph.masterGain.gain, this.configuration.masterVolume, this.context.currentTime, this.recoveryFade); }
  protected common(c: ResolvedSessionConfiguration) { return { waveform:c.waveform, masterVolume:c.masterVolume, leftVolume:c.leftVolume, rightVolume:c.rightVolume, ...(c.durationSeconds === undefined ? {} : { durationSeconds:c.durationSeconds }), fadeInSeconds:c.fadeInSeconds, fadeOutSeconds:c.fadeOutSeconds, transitionSeconds:c.transitionSeconds, safety:c.safety } as const; }
  protected toInput(c: ResolvedSessionConfiguration, duration?: number): BinauralSessionConfiguration { const common = { ...this.common(c), ...(duration === undefined ? {} : { durationSeconds:duration }) }; return c.mode === "carrier-offset" ? { mode:"carrier-offset", carrierHz:c.carrierHz, binauralHz:c.binauralHz, ...common } : { mode:"direct", leftHz:c.leftHz, rightHz:c.rightHz, ...common }; }
  protected mutable(operation: string): ResolvedSessionConfiguration { this.assertUsable(operation); if (!this.configuration || !["running","paused","interrupted","interaction-required"].includes(this.state)) throw this.invalid(operation); return this.configuration; }
  protected computeElapsed(): number { if (this.startTime === undefined || !this.context) return this.elapsed; this.elapsed = Math.max(this.elapsed, this.context.currentTime - this.startTime); return this.elapsed; }
  protected startProgress(): void { this.stopProgress(); this.intervalId = this.options.clock.setInterval(() => { const s = this.getState(); this.emit({ type:"progress", elapsedSeconds:s.elapsedSeconds, ...(s.remainingSeconds === undefined ? {} : { remainingSeconds:s.remainingSeconds }) }); }, this.progressMs); }
  protected stopProgress(): void { if (this.intervalId !== undefined) { this.options.clock.clearInterval(this.intervalId); this.intervalId = undefined; } }
  protected cleanup(): void { this.stopProgress(); if (this.graph) for (const node of [this.graph.leftOscillator,this.graph.rightOscillator,this.graph.leftGain,this.graph.rightGain,this.graph.merger,this.graph.masterGain,this.graph.limiter]) { try { node.disconnect(); } catch { } } this.graph = null; this.startTime = undefined; this.endTime = undefined; this.ended = 0; }
  protected configurationChanged(): void { if (this.configuration) this.emit({ type:"configurationchange", configuration:this.configuration }); }
  protected emit(event: AudioEngineEvent): void { this.listeners.forEach((listener) => listener(event)); }
  protected transition(next: AudioEngineState, operation: string): void { const previous = this.state; assertTransition(previous, next, operation, this.context?.state); this.state = next; if (previous !== next) this.emit({ type:"statechange", previous, current:next }); }
  protected enterError(error: AudioEngineError): void { if (this.state !== "error") { try { this.transition("error", "error"); } catch { this.state = "error"; } } this.emit({ type:"error", error }); }
  protected requireContext(operation: string): AudioContextLike { if (!this.context) throw this.makeError(undefined, "AUDIO_API_UNAVAILABLE", "Contexto ausente.", operation); if (this.context.state === "closed") throw this.makeError(undefined, "CONTEXT_CLOSED", "Contexto fechado.", operation); return this.context; }
  protected assertUsable(operation: string): void { if (this.state === "disposed") throw this.makeError(undefined, "ENGINE_DISPOSED", "Motor descartado.", operation); }
  protected invalid(operation: string): AudioEngineError { return this.makeError(undefined, "INVALID_STATE_TRANSITION", `Operação ${operation} inválida em ${this.state}.`, operation); }
  protected makeError(cause: unknown, code: ConstructorParameters<typeof AudioEngineError>[0], message: string, operation: string): AudioEngineError { return cause instanceof AudioEngineError ? cause : new AudioEngineError(code, message, { operation, state:this.state, ...(this.context ? { contextState:this.context.state } : {}) }, cause); }
}
