import { rampFromSilence, rampLinear, rampToSilence } from "./audio-automation.js";
import { AudioEngineBase } from "./audio-engine-base.js";
import { AudioEngineError } from "./errors.js";
import { resolveSessionConfiguration, validateBinauralFrequency, validateCarrierFrequency, validateChannelFrequency, validateChannelVolume, validateMasterVolume } from "./validation.js";
import type { AudioChannel, AudioEngineSnapshot, BinauralSessionConfiguration } from "./types.js";

export class AudioEngine extends AudioEngineBase {
  async initialize(): Promise<AudioEngineSnapshot> {
    this.assertUsable("initialize");
    if (this.context !== null && this.context.state !== "closed") { if (this.state === "uninitialized") this.transition("idle", "initialize-existing"); return this.getState(); }
    try { this.context = this.options.contextFactory.create(); this.context.onstatechange = () => this.handleContextChange(); if (this.state === "error" || this.state === "interaction-required") this.transition("idle", "initialize-recovery"); else if (this.state === "uninitialized") this.transition("idle", "initialize"); return this.getState(); }
    catch (cause) { const error = this.makeError(cause, "AUDIO_API_UNAVAILABLE", "Falha ao criar AudioContext.", "initialize"); this.enterError(error); throw error; }
  }

  async start(input: BinauralSessionConfiguration): Promise<AudioEngineSnapshot> {
    this.assertUsable("start"); if (["starting","running","pausing","paused","resuming","stopping","recovering"].includes(this.state)) throw this.invalid("start");
    const config = resolveSessionConfiguration(input, this.state, this.limits); if (this.state === "error" || this.state === "interaction-required") this.transition("idle", "start-reset");
    if (this.context === null || this.context.state === "closed") { this.context = null; this.state = "uninitialized"; await this.initialize(); }
    const ctx = this.requireContext("start"), generation = ++this.generation; this.transition("starting", "start"); this.desiredPlayback = true; this.requiresUserGesture = false; this.pauseReason = "none";
    try {
      if (ctx.state !== "running") { this.manualContextOperation = true; await ctx.resume(); this.manualContextOperation = false; }
      if (generation !== this.generation || this.state === "stopping") return this.getState();
      if (ctx.state !== "running") throw new AudioEngineError("INTERACTION_REQUIRED", "AudioContext não retomou.", { operation:"start", state:this.state, contextState:ctx.state });
      const graph = this.createGraph(config); this.graph = graph; this.configuration = config; this.ended = 0; this.stopKind = "none"; this.startTime = ctx.currentTime; this.elapsed = 0; this.endTime = config.durationSeconds === undefined ? undefined : ctx.currentTime + config.durationSeconds;
      graph.leftOscillator.onended = () => this.onEnded(graph); graph.rightOscillator.onended = () => this.onEnded(graph); graph.leftOscillator.start(ctx.currentTime); graph.rightOscillator.start(ctx.currentTime); rampFromSilence(graph.masterGain.gain, config.masterVolume, ctx.currentTime, config.fadeInSeconds);
      this.scheduleAutomatic(graph); this.startProgress(); this.transition("running", "start-complete"); this.emit({ type:"sessionstart", configuration:config }); return this.getState();
    } catch (cause) {
      this.manualContextOperation = false; this.cleanup();
      if (ctx.state !== "running" || (cause instanceof AudioEngineError && cause.code === "INTERACTION_REQUIRED")) { const error = cause instanceof AudioEngineError ? cause : this.makeError(cause, "INTERACTION_REQUIRED", "Interação necessária.", "start"); this.requiresUserGesture = true; this.transition("interaction-required", "start-blocked"); this.emit({ type:"interactionrequired", message:error.toFriendlyMessage() }); this.emit({ type:"error", error }); throw error; }
      const error = this.makeError(cause, "START_FAILED", "Falha ao iniciar.", "start"); this.enterError(error); throw error;
    }
  }

  async pause(): Promise<AudioEngineSnapshot> {
    this.assertUsable("pause"); if (this.state === "paused" || this.state === "pausing") return this.getState(); if (this.state !== "running") throw this.invalid("pause");
    const ctx = this.requireContext("pause"); this.transition("pausing", "pause"); this.pauseReason = "manual";
    try { this.manualContextOperation = true; await ctx.suspend(); this.manualContextOperation = false; this.transition("paused", "pause-complete"); this.emit({ type:"pause", reason:"manual" }); return this.getState(); }
    catch (cause) { this.manualContextOperation = false; const error = this.makeError(cause, "SUSPEND_FAILED", "Falha ao pausar.", "pause"); this.enterError(error); throw error; }
  }

  async resume(): Promise<AudioEngineSnapshot> {
    this.assertUsable("resume"); if (this.state === "running" || this.state === "resuming") return this.getState(); if (this.state !== "paused") throw this.invalid("resume");
    const ctx = this.requireContext("resume"); this.transition("resuming", "resume");
    try { this.manualContextOperation = true; await ctx.resume(); this.manualContextOperation = false; if (ctx.state !== "running") throw new Error("blocked"); this.recoveryRamp(); this.pauseReason = "none"; this.transition("running", "resume-complete"); this.emit({ type:"resume", reason:"manual" }); return this.getState(); }
    catch (cause) { this.manualContextOperation = false; const error = this.makeError(cause, "RESUME_FAILED", "Falha ao retomar.", "resume"); this.requiresUserGesture = true; this.transition("interaction-required", "resume-blocked"); this.emit({ type:"interactionrequired", message:error.toFriendlyMessage() }); this.emit({ type:"error", error }); throw error; }
  }

  async recover(userGesture: boolean): Promise<AudioEngineSnapshot> {
    this.assertUsable("recover"); if (this.state === "running") return this.getState(); if (!["interrupted","interaction-required","error"].includes(this.state)) throw this.invalid("recover");
    const saved = this.configuration, remaining = this.getState().remainingSeconds;
    if (this.context === null || this.context.state === "closed") {
      if (!userGesture) { const error = this.makeError(undefined, "INTERACTION_REQUIRED", "Gesto necessário.", "recover"); this.requiresUserGesture = true; if (this.state === "interrupted") this.transition("interaction-required", "recover-needs-gesture"); this.emit({ type:"interactionrequired", message:error.toFriendlyMessage() }); throw error; }
      if (saved === undefined) { if (this.state !== "idle") this.transition("idle", "recover-empty"); return this.getState(); }
      this.cleanup(); this.context = null; if (this.state === "error") this.transition("idle", "recover-error-reset"); else if (this.state !== "idle") { this.transition("interaction-required", "recover-closed"); this.transition("idle", "recover-reset"); } this.state = "uninitialized"; return this.start(this.toInput(saved, remaining));
    }
    if (this.context.state === "running") { if (this.state === "interrupted") this.transition("recovering", "recover-running"); else this.transition("idle", "recover-running-reset"); if (this.state === "idle") return saved === undefined ? this.getState() : this.start(this.toInput(saved, remaining)); this.recoveryRamp(); this.pauseReason = "none"; this.requiresUserGesture = false; this.transition("running", "recover-complete"); this.emit({ type:"recovered" }); return this.getState(); }
    if (this.state === "interrupted" || this.state === "interaction-required") this.transition("recovering", "recover"); else this.transition("starting", "recover-error");
    try { this.manualContextOperation = true; await this.context.resume(); this.manualContextOperation = false; const resumedState: string = this.context.state; if (resumedState !== "running") throw new Error("blocked"); this.recoveryRamp(); this.pauseReason = "none"; this.requiresUserGesture = false; this.transition("running", "recover-complete"); this.emit({ type:"recovered" }); return this.getState(); }
    catch (cause) { this.manualContextOperation = false; const error = this.makeError(cause, "RECOVERY_FAILED", "Falha na recuperação.", "recover"); this.requiresUserGesture = true; this.transition("interaction-required", "recover-failed"); this.emit({ type:"interactionrequired", message:error.toFriendlyMessage() }); this.emit({ type:"error", error }); throw error; }
  }

  async stop(): Promise<AudioEngineSnapshot> {
    this.assertUsable("stop"); if (this.state === "uninitialized" || this.state === "idle") return this.getState(); if (this.state === "stopping" && this.stopPromise !== undefined) { await this.stopPromise; return this.getState(); }
    ++this.generation; const graph = this.graph; if (this.state !== "stopping") this.transition("stopping", "stop"); this.desiredPlayback = false; this.requiresUserGesture = false; this.pauseReason = "none";
    if (graph === null) { this.cleanup(); this.transition("idle", "stop-empty"); this.emit({ type:"stop", automatic:false }); return this.getState(); }
    const ctx = this.requireContext("stop"); if (["suspended","interrupted"].includes(ctx.state)) { try { this.manualContextOperation = true; await ctx.resume(); this.manualContextOperation = false; } catch { this.manualContextOperation = false; this.cleanup(); this.transition("idle", "stop-emergency"); this.emit({ type:"stop", automatic:false }); return this.getState(); } }
    this.stopKind = "manual"; this.stopPromise = new Promise<void>((resolve) => { this.resolveStop = resolve; }); const when = rampToSilence(graph.masterGain.gain, ctx.currentTime, this.configuration?.fadeOutSeconds ?? .35); graph.leftOscillator.stop(when); graph.rightOscillator.stop(when); await this.stopPromise; return this.getState();
  }

  setMasterVolume(value: number): AudioEngineSnapshot { const c = this.mutable("setMasterVolume"), v = validateMasterVolume(value, c, this.state, this.limits); this.configuration = Object.freeze({ ...c, masterVolume:v }); if (this.graph && this.context) rampLinear(this.graph.masterGain.gain, v, this.context.currentTime, c.transitionSeconds); this.configurationChanged(); return this.getState(); }
  setChannelVolume(channel: AudioChannel, value: number): AudioEngineSnapshot { const c = this.mutable("setChannelVolume"), v = validateChannelVolume(value, this.state, this.limits); this.configuration = Object.freeze({ ...c, [channel === "left" ? "leftVolume" : "rightVolume"]:v }); const gain = channel === "left" ? this.graph?.leftGain : this.graph?.rightGain; if (gain && this.context) rampLinear(gain.gain, v, this.context.currentTime, c.transitionSeconds); this.configurationChanged(); return this.getState(); }
  setCarrierFrequency(value: number): AudioEngineSnapshot { const c = this.mutable("setCarrierFrequency"), carrier = validateCarrierFrequency(value, this.state, this.limits); return this.apply({ mode:"carrier-offset", carrierHz:carrier, binauralHz:c.binauralHz, ...this.common(c) }); }
  setBinauralFrequency(value: number): AudioEngineSnapshot { const c = this.mutable("setBinauralFrequency"), binaural = validateBinauralFrequency(value, this.state, this.limits); return this.apply({ mode:"carrier-offset", carrierHz:c.carrierHz, binauralHz:binaural, ...this.common(c) }); }
  setChannelFrequency(channel: AudioChannel, value: number): AudioEngineSnapshot { const c = this.mutable("setChannelFrequency"), hz = validateChannelFrequency(value, this.state, this.limits); return this.apply({ mode:"direct", leftHz:channel === "left" ? hz : c.leftHz, rightHz:channel === "right" ? hz : c.rightHz, ...this.common(c) }); }

  async dispose(): Promise<void> { if (this.state === "disposed") return; ++this.generation; this.desiredPlayback = false; this.cleanup(); if (this.context) { this.context.onstatechange = null; if (this.context.state !== "closed") { this.manualContextOperation = true; try { await this.context.close(); } finally { this.manualContextOperation = false; } } } const previous = this.state; this.state = "disposed"; this.listeners.forEach((listener) => listener({ type:"statechange", previous, current:"disposed" })); this.listeners.clear(); }

  private apply(input: BinauralSessionConfiguration): AudioEngineSnapshot { const c = resolveSessionConfiguration(input, this.state, this.limits); this.configuration = c; if (this.graph && this.context) { rampLinear(this.graph.leftOscillator.frequency, c.leftHz, this.context.currentTime, c.transitionSeconds); rampLinear(this.graph.rightOscillator.frequency, c.rightHz, this.context.currentTime, c.transitionSeconds); } this.configurationChanged(); return this.getState(); }
}
