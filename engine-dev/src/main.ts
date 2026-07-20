import { disposeAudioEngine, getAudioEngine } from "./audio/index.js";
import type { AudioEngineEvent } from "./audio/types.js";
import { BrowserLifecycleCoordinator } from "./lifecycle/index.js";
import type { LifecycleSnapshot, WindowLike } from "./lifecycle/types.js";

const engine = getAudioEngine();
const lifecycle = new BrowserLifecycleCoordinator(engine, window as unknown as WindowLike);
const eventLog: string[] = [];

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (result === null) throw new Error(`Elemento obrigatório ausente: ${id}`);
  return result as T;
}

function numberValue(id: string): number {
  return Number(element<HTMLInputElement>(id).value);
}

function appendLog(message: string): void {
  eventLog.unshift(message);
  if (eventLog.length > 80) eventLog.length = 80;
  const list = element<HTMLOListElement>("eventLog");
  list.replaceChildren(
    ...eventLog.map((entry) => {
      const item = document.createElement("li");
      const time = document.createElement("time");
      time.textContent = new Date().toLocaleTimeString("pt-BR");
      item.append(time, entry);
      return item;
    })
  );
}

function describeEvent(event: AudioEngineEvent): string {
  switch (event.type) {
    case "statechange":
      return `estado ${event.previous} → ${event.current}`;
    case "configurationchange":
      return `configuração L=${event.configuration.leftHz} Hz R=${event.configuration.rightHz} Hz`;
    case "progress":
      return `progresso ${event.elapsedSeconds.toFixed(2)} s`;
    case "error":
      return `erro ${event.error.code}: ${event.error.toFriendlyMessage()}`;
    case "pause":
      return `pausa (${event.reason})`;
    case "resume":
      return `retomada (${event.reason})`;
    default:
      return event.type;
  }
}

function render(snapshot: LifecycleSnapshot): void {
  const engineSnapshot = snapshot.engine;
  const configuration = engineSnapshot.configuration;
  element("overallStatus").textContent = engineSnapshot.state;
  element("engineState").textContent = engineSnapshot.state;
  element("contextState").textContent = engineSnapshot.contextState;
  element("desiredPlayback").textContent = engineSnapshot.desiredPlayback ? "sim" : "não";
  element("pauseReason").textContent = engineSnapshot.pauseReason;
  element("interactionRequired").textContent = engineSnapshot.requiresUserGesture ? "sim" : "não";
  element("wakeLockStatus").textContent = snapshot.wakeLock;
  element("pwaStatus").textContent = snapshot.pwaUpdate;
  element("onlineStatus").textContent = snapshot.online;
  element("visibilityStatus").textContent = snapshot.visibility;
  element("focusStatus").textContent = snapshot.focused ? "sim" : "não";
  element("elapsed").textContent = `${engineSnapshot.elapsedSeconds.toFixed(2)} s`;
  element("remaining").textContent =
    engineSnapshot.remainingSeconds === undefined ? "—" : `${engineSnapshot.remainingSeconds.toFixed(2)} s`;
  element("leftFrequency").textContent = configuration === undefined ? "—" : `${configuration.leftHz} Hz`;
  element("rightFrequency").textContent = configuration === undefined ? "—" : `${configuration.rightHz} Hz`;
  element("graphActive").textContent = engineSnapshot.graphActive ? "sim" : "não";
  element("recoveryMessage").textContent = snapshot.recoveryMessage;
}

engine.subscribe((event) => {
  if (event.type !== "progress" || Math.round(event.elapsedSeconds) % 5 === 0) appendLog(describeEvent(event));
  render(lifecycle.getState());
});

lifecycle.subscribe(render);
lifecycle.attach();

element<HTMLButtonElement>("initializeButton").addEventListener("click", async () => {
  try {
    await engine.initialize();
    appendLog("AudioContext criado após gesto do usuário");
  } catch (error) {
    appendLog(error instanceof Error ? error.message : "Falha desconhecida na inicialização");
  }
  render(lifecycle.getState());
});

element<HTMLButtonElement>("startButton").addEventListener("click", async () => {
  try {
    await engine.start({
      mode: "carrier-offset",
      carrierHz: numberValue("carrier"),
      binauralHz: numberValue("binaural"),
      durationSeconds: numberValue("duration"),
      masterVolume: numberValue("volume"),
      leftVolume: 0.5,
      rightVolume: 0.5,
      fadeInSeconds: 1.2,
      fadeOutSeconds: 0.35,
      transitionSeconds: 0.08,
      safety: { maxMasterVolume: 0.3 }
    });
  } catch (error) {
    appendLog(error instanceof Error ? error.message : "Falha desconhecida ao iniciar");
  }
  render(lifecycle.getState());
});

element<HTMLButtonElement>("pauseButton").addEventListener("click", async () => {
  try { await engine.pause(); } catch (error) { appendLog(error instanceof Error ? error.message : "Falha ao pausar"); }
  render(lifecycle.getState());
});

element<HTMLButtonElement>("resumeButton").addEventListener("click", async () => {
  try { await engine.resume(); } catch (error) { appendLog(error instanceof Error ? error.message : "Falha ao retomar"); }
  render(lifecycle.getState());
});

element<HTMLButtonElement>("stopButton").addEventListener("click", async () => {
  try { await engine.stop(); } catch (error) { appendLog(error instanceof Error ? error.message : "Falha ao parar"); }
  render(lifecycle.getState());
});

element<HTMLButtonElement>("recoverButton").addEventListener("click", async () => {
  await lifecycle.recoverFromUserGesture();
  render(lifecycle.getState());
});

element<HTMLInputElement>("volume").addEventListener("input", () => {
  const value = numberValue("volume");
  element<HTMLOutputElement>("volumeOutput").value = value.toFixed(2);
  if (engine.getState().configuration !== undefined) {
    try { engine.setMasterVolume(value); } catch (error) { appendLog(error instanceof Error ? error.message : "Volume inválido"); }
  }
});

element<HTMLButtonElement>("applyCarrierButton").addEventListener("click", () => {
  try { engine.setCarrierFrequency(numberValue("liveCarrier")); } catch (error) { appendLog(error instanceof Error ? error.message : "Portadora inválida"); }
  render(lifecycle.getState());
});

element<HTMLButtonElement>("applyBinauralButton").addEventListener("click", () => {
  try { engine.setBinauralFrequency(numberValue("liveBinaural")); } catch (error) { appendLog(error instanceof Error ? error.message : "Diferença inválida"); }
  render(lifecycle.getState());
});

element<HTMLButtonElement>("checkUpdateButton").addEventListener("click", async () => {
  await lifecycle.checkPwaUpdate();
  render(lifecycle.getState());
});

element<HTMLButtonElement>("applyUpdateButton").addEventListener("click", () => {
  lifecycle.applyPwaUpdate();
  render(lifecycle.getState());
});

window.addEventListener("beforeunload", () => {
  void lifecycle.dispose();
  void disposeAudioEngine();
});
