(() => {
  "use strict";

  const FREQUENCY_MIN = 80;
  const FREQUENCY_MAX = 500;
  const FREQUENCY_STEP = 1;
  const DEFAULTS = Object.freeze({ left: 200, right: 206, volume: 0.10, duration: 1500 });

  const STATE_DEFINITIONS = Object.freeze([
    { id: "near", min: 0, max: 0.5, label: "Near Mono", range: "0–0.5 Hz", color: "#5B6478" },
    { id: "delta", min: 0.5, max: 4, label: "Delta State", range: "0.5–4 Hz", color: "#004B23" },
    { id: "theta", min: 4, max: 8, label: "Theta State", range: "4–8 Hz", color: "#8A2BE2" },
    { id: "alpha", min: 8, max: 12, label: "Alpha State", range: "8–12 Hz", color: "#00F0FF" },
    { id: "beta", min: 12, max: 30, label: "Beta State", range: "12–30 Hz", color: "#FF8A00" },
    { id: "gamma", min: 30, max: Infinity, label: "Gamma State", range: "30+ Hz", color: "#FF2D95" }
  ]);

  const PRESETS = Object.freeze({
    delta: { left: 200, right: 202 },
    theta: { left: 200, right: 206 },
    alpha: { left: 200, right: 210 }
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const $ = (id) => document.getElementById(id);

  class BinauralEngine {
    constructor() {
      this.context = null;
      this.leftOscillator = null;
      this.rightOscillator = null;
      this.masterGain = null;
      this.nodes = [];
      this.status = "idle";
    }

    async ensureContext() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Este navegador não oferece suporte à Web Audio API.");
      if (!this.context || this.context.state === "closed") this.context = new AudioContextClass();
      if (this.context.state === "suspended") await this.context.resume();
    }

    async start(leftHz, rightHz, volume) {
      await this.ensureContext();
      this.disposeNodes();

      const ctx = this.context;
      const leftOscillator = ctx.createOscillator();
      const rightOscillator = ctx.createOscillator();
      const leftGain = ctx.createGain();
      const rightGain = ctx.createGain();
      const merger = ctx.createChannelMerger(2);
      const masterGain = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();

      leftOscillator.type = "sine";
      rightOscillator.type = "sine";
      leftOscillator.frequency.setValueAtTime(leftHz, ctx.currentTime);
      rightOscillator.frequency.setValueAtTime(rightHz, ctx.currentTime);
      leftGain.gain.setValueAtTime(0.5, ctx.currentTime);
      rightGain.gain.setValueAtTime(0.5, ctx.currentTime);

      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);

      limiter.threshold.setValueAtTime(-18, ctx.currentTime);
      limiter.knee.setValueAtTime(10, ctx.currentTime);
      limiter.ratio.setValueAtTime(12, ctx.currentTime);
      limiter.attack.setValueAtTime(0.003, ctx.currentTime);
      limiter.release.setValueAtTime(0.25, ctx.currentTime);

      leftOscillator.connect(leftGain);
      rightOscillator.connect(rightGain);
      leftGain.connect(merger, 0, 0);
      rightGain.connect(merger, 0, 1);
      merger.connect(masterGain);
      masterGain.connect(limiter);
      limiter.connect(ctx.destination);

      leftOscillator.start();
      rightOscillator.start();

      this.leftOscillator = leftOscillator;
      this.rightOscillator = rightOscillator;
      this.masterGain = masterGain;
      this.nodes = [leftOscillator, rightOscillator, leftGain, rightGain, merger, limiter];
      this.status = "running";
    }

    async pause() {
      if (!this.context || this.status !== "running") return;
      await this.context.suspend();
      this.status = "paused";
    }

    async resume() {
      if (!this.context || this.status !== "paused") return;
      await this.context.resume();
      this.status = "running";
    }

    updateFrequencies(leftHz, rightHz) {
      if (!this.context || !this.leftOscillator || !this.rightOscillator) return;
      const now = this.context.currentTime;
      this.leftOscillator.frequency.setTargetAtTime(leftHz, now, 0.025);
      this.rightOscillator.frequency.setTargetAtTime(rightHz, now, 0.025);
    }

    setVolume(volume) {
      if (!this.context || !this.masterGain) return;
      const now = this.context.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(volume, now, 0.035);
    }

    stop(fadeSeconds = 0.16) {
      if (!this.context || !this.masterGain) {
        this.disposeNodes();
        this.status = "idle";
        return;
      }
      const now = this.context.currentTime;
      try {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(Math.max(this.masterGain.gain.value, 0.0001), now);
        this.masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
      } catch (_) {}
      window.setTimeout(() => this.disposeNodes(), Math.ceil((fadeSeconds + 0.05) * 1000));
      this.status = "idle";
    }

    disposeNodes() {
      this.nodes.forEach((node) => {
        try { node.stop?.(); } catch (_) {}
        try { node.disconnect?.(); } catch (_) {}
      });
      this.nodes = [];
      this.leftOscillator = null;
      this.rightOscillator = null;
      this.masterGain = null;
    }
  }

  class RotaryKnob {
    constructor(element, options) {
      this.element = element;
      this.value = options.value;
      this.min = options.min;
      this.max = options.max;
      this.step = options.step;
      this.onChange = options.onChange;
      this.drag = null;
      this.bind();
      this.render();
    }

    bind() {
      this.element.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
      this.element.addEventListener("pointermove", (event) => this.handlePointerMove(event));
      this.element.addEventListener("pointerup", (event) => this.handlePointerUp(event));
      this.element.addEventListener("pointercancel", (event) => this.handlePointerUp(event));
      this.element.addEventListener("keydown", (event) => this.handleKeyDown(event));
      this.element.addEventListener("wheel", (event) => {
        event.preventDefault();
        this.setValue(this.value + (event.deltaY < 0 ? this.step : -this.step));
      }, { passive: false });
    }

    handlePointerDown(event) {
      event.preventDefault();
      this.element.setPointerCapture(event.pointerId);
      this.element.classList.add("is-dragging");
      this.drag = { pointerId: event.pointerId, startY: event.clientY, startX: event.clientX, startValue: this.value };
    }

    handlePointerMove(event) {
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      const verticalDelta = this.drag.startY - event.clientY;
      const horizontalDelta = event.clientX - this.drag.startX;
      const combinedDelta = verticalDelta + horizontalDelta * 0.45;
      this.setValue(this.drag.startValue + combinedDelta * 0.55);
    }

    handlePointerUp(event) {
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      this.element.releasePointerCapture?.(event.pointerId);
      this.element.classList.remove("is-dragging");
      this.drag = null;
    }

    handleKeyDown(event) {
      const increments = {
        ArrowUp: this.step,
        ArrowRight: this.step,
        ArrowDown: -this.step,
        ArrowLeft: -this.step,
        PageUp: this.step * 10,
        PageDown: -this.step * 10
      };
      if (event.key === "Home") {
        event.preventDefault();
        this.setValue(this.min);
      } else if (event.key === "End") {
        event.preventDefault();
        this.setValue(this.max);
      } else if (Object.prototype.hasOwnProperty.call(increments, event.key)) {
        event.preventDefault();
        this.setValue(this.value + increments[event.key]);
      }
    }

    setValue(nextValue, emit = true) {
      const stepped = Math.round(nextValue / this.step) * this.step;
      const clamped = clamp(stepped, this.min, this.max);
      if (clamped === this.value) return;
      this.value = clamped;
      this.render();
      if (emit) this.onChange(this.value);
    }

    render() {
      const normalized = (this.value - this.min) / (this.max - this.min);
      const angle = -135 + normalized * 270;
      this.element.style.setProperty("--angle", `${angle}deg`);
      this.element.setAttribute("aria-valuenow", String(this.value));
      this.element.setAttribute("aria-valuetext", `${this.value} hertz`);
    }
  }

  class WaveVisualizer {
    constructor(canvas, getState) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d", { alpha: true });
      this.getState = getState;
      this.phase = 0;
      this.width = 1;
      this.height = 1;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas.parentElement);
      this.resize();
      requestAnimationFrame(() => this.frame());
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    frame() {
      const { difference, playing, accent } = this.getState();
      const ctx = this.context;
      const w = this.width;
      const h = this.height;
      ctx.clearRect(0, 0, w, h);
      this.phase += playing ? 0.05 : 0.018;

      const centerY = h * 0.5;
      const amplitude = Math.min(h * 0.25, 28 + difference * 2.2);
      const layers = playing ? 12 : 8;
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.2, `${accent}aa`);
      gradient.addColorStop(0.5, `${accent}ff`);
      gradient.addColorStop(0.8, `${accent}aa`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let layer = 0; layer < layers; layer += 1) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const n = (x / w) * 2 - 1;
          const envelope = Math.pow(Math.max(0, 1 - Math.abs(n)), 0.65);
          const wave =
            Math.sin(n * (13 + difference * 0.18) + this.phase * 2 + layer * 0.09) * 0.52 +
            Math.sin(n * 29 - this.phase * 1.15 - layer * 0.06) * 0.25 +
            Math.sin(n * 47 + this.phase * 0.72) * 0.12;
          const y = centerY + wave * amplitude * envelope + (layer - layers / 2) * 2.1;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = gradient;
        ctx.globalAlpha = 0.08 + layer / layers * 0.08;
        ctx.lineWidth = layer === Math.floor(layers / 2) ? 1.8 : 0.8;
        ctx.stroke();
      }
      ctx.restore();
      requestAnimationFrame(() => this.frame());
    }
  }

  class MatrixGraph {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d");
      this.left = DEFAULTS.left;
      this.right = DEFAULTS.right;
      this.accent = "#8A2BE2";
      new ResizeObserver(() => this.render()).observe(canvas.parentElement);
    }

    update(left, right, accent) {
      this.left = left;
      this.right = right;
      this.accent = accent;
      this.render();
    }

    render() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(280, rect.width || 420);
      const height = 100;
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const ctx = this.context;
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(255,255,255,.07)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += width / 8) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y <= height; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      const draw = (frequency, offset, alpha) => {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 2) {
          const y = height / 2 + Math.sin((x / width) * Math.PI * 7 + offset) * 18 * Math.sin((x / width) * Math.PI);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `${this.accent}${alpha}`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const markerX = ((frequency - FREQUENCY_MIN) / (FREQUENCY_MAX - FREQUENCY_MIN)) * width;
        ctx.fillStyle = this.accent;
        ctx.shadowColor = this.accent;
        ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(markerX, height / 2, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      };

      draw(this.left, 0, "b8");
      draw(this.right, 0.8, "7d");
    }
  }

  class AppController {
    constructor() {
      const stored = this.loadStoredState();
      this.left = stored.left;
      this.right = stored.right;
      this.volume = stored.volume;
      this.duration = stored.duration;
      this.remaining = this.duration;
      this.timer = null;
      this.engine = new BinauralEngine();
      this.currentState = this.resolveState();

      this.leftKnob = new RotaryKnob($("leftKnob"), {
        min: FREQUENCY_MIN, max: FREQUENCY_MAX, step: FREQUENCY_STEP, value: this.left,
        onChange: (value) => this.setFrequency("left", value)
      });
      this.rightKnob = new RotaryKnob($("rightKnob"), {
        min: FREQUENCY_MIN, max: FREQUENCY_MAX, step: FREQUENCY_STEP, value: this.right,
        onChange: (value) => this.setFrequency("right", value)
      });

      this.wave = new WaveVisualizer($("waveCanvas"), () => ({
        difference: Math.abs(this.right - this.left),
        playing: this.engine.status === "running",
        accent: this.currentState.color
      }));
      this.matrix = new MatrixGraph($("matrixCanvas"));
      this.bind();
      this.syncInputs();
      this.render();
    }

    loadStoredState() {
      try {
        const saved = JSON.parse(localStorage.getItem("binaural-flow-state") || "null");
        if (!saved) return { ...DEFAULTS };
        return {
          left: clamp(Number(saved.left) || DEFAULTS.left, FREQUENCY_MIN, FREQUENCY_MAX),
          right: clamp(Number(saved.right) || DEFAULTS.right, FREQUENCY_MIN, FREQUENCY_MAX),
          volume: clamp(Number(saved.volume) || DEFAULTS.volume, 0, 0.3),
          duration: [900, 1500, 2700, 3600].includes(Number(saved.duration)) ? Number(saved.duration) : DEFAULTS.duration
        };
      } catch (_) {
        return { ...DEFAULTS };
      }
    }

    saveState() {
      localStorage.setItem("binaural-flow-state", JSON.stringify({
        left: this.left,
        right: this.right,
        volume: this.volume,
        duration: this.duration
      }));
    }

    bind() {
      document.querySelectorAll("[data-adjust]").forEach((button) => {
        button.addEventListener("click", () => {
          const side = button.dataset.adjust;
          const delta = Number(button.dataset.delta);
          const knob = side === "left" ? this.leftKnob : this.rightKnob;
          knob.setValue(knob.value + delta);
        });
      });

      document.querySelectorAll("[data-preset]").forEach((button) => {
        button.addEventListener("click", () => this.applyPreset(button.dataset.preset));
      });

      $("playButton").addEventListener("click", () => this.togglePlayback());
      $("stopButton").addEventListener("click", () => this.stopPlayback(true));
      $("resetButton").addEventListener("click", () => this.reset());
      $("volume").addEventListener("input", (event) => {
        this.volume = Number(event.target.value);
        this.engine.setVolume(this.volume);
        this.saveState();
        this.renderVolume();
      });
      $("duration").addEventListener("change", (event) => {
        this.duration = Number(event.target.value);
        if (this.engine.status === "idle") this.remaining = this.duration;
        this.saveState();
        this.renderTimer();
      });
      addEventListener("beforeunload", () => this.engine.disposeNodes());
    }

    syncInputs() {
      $("volume").value = String(this.volume);
      $("duration").value = String(this.duration);
    }

    resolveState() {
      const difference = Math.abs(this.right - this.left);
      return STATE_DEFINITIONS.find((state) => difference >= state.min && difference < state.max) || STATE_DEFINITIONS.at(-1);
    }

    setFrequency(side, value) {
      if (side === "left") this.left = value; else this.right = value;
      this.engine.updateFrequencies(this.left, this.right);
      this.currentState = this.resolveState();
      this.saveState();
      this.render();
    }

    applyPreset(name) {
      const preset = PRESETS[name];
      if (!preset) return;
      this.left = preset.left;
      this.right = preset.right;
      this.leftKnob.setValue(this.left, false);
      this.rightKnob.setValue(this.right, false);
      this.engine.updateFrequencies(this.left, this.right);
      this.currentState = this.resolveState();
      this.saveState();
      this.render();
      this.toast(`${this.currentState.label} aplicado.`);
    }

    async togglePlayback() {
      try {
        if (this.engine.status === "idle") {
          await this.engine.start(this.left, this.right, this.volume);
          this.startTimer();
          this.toast("Sessão iniciada em volume baixo.");
        } else if (this.engine.status === "running") {
          await this.engine.pause();
          clearInterval(this.timer);
          this.toast("Sessão pausada.");
        } else if (this.engine.status === "paused") {
          await this.engine.resume();
          this.startTimer();
          this.toast("Sessão retomada.");
        }
        this.renderTransport();
      } catch (error) {
        this.toast(error.message || "Não foi possível iniciar o áudio.");
      }
    }

    stopPlayback(resetTimer) {
      clearInterval(this.timer);
      this.timer = null;
      this.engine.stop();
      if (resetTimer) this.remaining = this.duration;
      this.renderTransport();
      this.renderTimer();
    }

    startTimer() {
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (this.engine.status !== "running") return;
        this.remaining -= 1;
        if (this.remaining <= 0) {
          this.remaining = 0;
          this.stopPlayback(false);
          this.toast("Sessão concluída.");
        }
        this.renderTimer();
      }, 1000);
    }

    reset() {
      this.stopPlayback(true);
      this.left = DEFAULTS.left;
      this.right = DEFAULTS.right;
      this.volume = DEFAULTS.volume;
      this.duration = DEFAULTS.duration;
      this.remaining = DEFAULTS.duration;
      this.leftKnob.setValue(this.left, false);
      this.rightKnob.setValue(this.right, false);
      this.currentState = this.resolveState();
      this.syncInputs();
      this.saveState();
      this.render();
      this.toast("Valores padrão restaurados.");
    }

    render() {
      const difference = this.right - this.left;
      this.currentState = this.resolveState();
      document.body.style.setProperty("--accent", this.currentState.color);
      document.body.dataset.state = this.currentState.id;

      $("leftKnobValue").textContent = String(this.left);
      $("rightKnobValue").textContent = String(this.right);
      $("leftOutput").textContent = `${this.left} Hz`;
      $("rightOutput").textContent = `${this.right} Hz`;
      $("differenceValue").textContent = `${difference >= 0 ? "+" : ""}${difference.toFixed(2)}`;
      $("stateLabel").textContent = this.currentState.label;
      $("stateRange").textContent = this.currentState.range;
      $("matrixState").textContent = this.currentState.id.toUpperCase();

      document.querySelectorAll("[data-preset]").forEach((button) => {
        button.classList.toggle("active", button.dataset.preset === this.currentState.id);
      });

      this.matrix.update(this.left, this.right, this.currentState.color);
      this.renderVolume();
      this.renderTimer();
      this.renderTransport();
    }

    renderVolume() {
      $("volumeOutput").textContent = `${Math.round((this.volume / 0.3) * 100)}%`;
    }

    renderTimer() {
      const minutes = Math.floor(Math.max(0, this.remaining) / 60).toString().padStart(2, "0");
      const seconds = (Math.max(0, this.remaining) % 60).toString().padStart(2, "0");
      $("timerOutput").textContent = `${minutes}:${seconds}`;
    }

    renderTransport() {
      const isPlaying = this.engine.status === "running";
      const isPaused = this.engine.status === "paused";
      document.body.classList.toggle("is-playing", isPlaying);
      $("playIcon").textContent = isPlaying ? "Ⅱ" : "▶";
      $("playButton").setAttribute("aria-label", isPlaying ? "Pausar sessão" : isPaused ? "Retomar sessão" : "Iniciar sessão");
      const label = this.engine.status === "running" ? "Reproduzindo" : this.engine.status === "paused" ? "Pausado" : "Pronto";
      $("engineStatus").lastElementChild.textContent = label;
    }

    toast(message) {
      const toast = $("toast");
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
    }
  }

  new AppController();
})();
