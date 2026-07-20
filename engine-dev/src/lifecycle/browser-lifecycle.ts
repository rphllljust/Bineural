import type { AudioEngine } from "../audio/audio-engine.js";
import type { AudioEngineEvent } from "../audio/types.js";
import { LocalLifecycleLogger } from "./logger.js";
import { MediaSessionController } from "./media-session.js";
import { PwaUpdateController } from "./pwa-update.js";
import type {
  LifecycleListener,
  LifecycleSnapshot,
  OnlineStatus,
  PwaUpdateStatus,
  WakeLockStatus,
  WindowLike
} from "./types.js";
import { ScreenWakeLockController } from "./wake-lock.js";

const RELOAD_MARKER = "binaural-flow:interrupted-session";

export class BrowserLifecycleCoordinator {
  private attached = false;
  private focused: boolean;
  private online: OnlineStatus;
  private wakeLockStatus: WakeLockStatus;
  private pwaUpdateStatus: PwaUpdateStatus;
  private recoveryMessage = "";
  private listeners = new Set<LifecycleListener>();
  private unsubscribeEngine: (() => void) | undefined;
  private readonly wakeLock: ScreenWakeLockController;
  private readonly mediaSession: MediaSessionController;
  private readonly pwaUpdate: PwaUpdateController;
  private readonly logger: LocalLifecycleLogger;
  private readonly visibilityListener: EventListener = () => void this.handleVisibilityChange();
  private readonly pageHideListener: EventListener = () => this.handlePageHide();
  private readonly pageShowListener: EventListener = () => void this.handlePageShow();
  private readonly freezeListener: EventListener = () => this.handleFreeze();
  private readonly resumeListener: EventListener = () => void this.handleResumeEvent();
  private readonly focusListener: EventListener = () => this.handleFocus(true);
  private readonly blurListener: EventListener = () => this.handleFocus(false);
  private readonly onlineListener: EventListener = () => this.handleOnline(true);
  private readonly offlineListener: EventListener = () => this.handleOnline(false);
  private readonly deviceChangeListener = () => this.handleDeviceChange();

  constructor(
    private readonly engine: AudioEngine,
    private readonly windowLike: WindowLike
  ) {
    this.focused = windowLike.hasFocus();
    this.online = windowLike.navigator.onLine ? "online" : "offline";
    this.wakeLock = new ScreenWakeLockController(windowLike.navigator, (status) => {
      this.wakeLockStatus = status;
      this.logger.record("info", "wake-lock-status", { status });
      this.notify();
    });
    this.wakeLockStatus = this.wakeLock.getStatus();
    this.mediaSession = new MediaSessionController(windowLike.navigator, engine);
    this.pwaUpdate = new PwaUpdateController(
      windowLike.navigator.serviceWorker,
      () => windowLike.location.reload(),
      (status) => {
        this.pwaUpdateStatus = status;
        this.logger.record("info", "pwa-update-status", { status });
        this.notify();
      }
    );
    this.pwaUpdateStatus = this.pwaUpdate.getStatus();
    this.logger = new LocalLifecycleLogger(() => performance.now());
  }

  subscribe(listener: LifecycleListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    const documentLike = this.windowLike.document;
    documentLike.addEventListener("visibilitychange", this.visibilityListener);
    this.windowLike.addEventListener("pagehide", this.pageHideListener);
    this.windowLike.addEventListener("pageshow", this.pageShowListener);
    this.windowLike.addEventListener("freeze", this.freezeListener);
    this.windowLike.addEventListener("resume", this.resumeListener);
    this.windowLike.addEventListener("focus", this.focusListener);
    this.windowLike.addEventListener("blur", this.blurListener);
    this.windowLike.addEventListener("online", this.onlineListener);
    this.windowLike.addEventListener("offline", this.offlineListener);
    this.windowLike.navigator.mediaDevices?.addEventListener("devicechange", this.deviceChangeListener);
    this.unsubscribeEngine = this.engine.subscribe((event) => void this.handleEngineEvent(event));
    this.mediaSession.configure();
    void this.pwaUpdate.register();
    this.restoreReloadMarker();
    this.logger.record("info", "lifecycle-attached");
    this.notify();
  }

  async recoverFromUserGesture(): Promise<void> {
    const snapshot = this.engine.getState();
    if (!["interrupted", "interaction-required", "error"].includes(snapshot.state)) return;
    try {
      await this.engine.recover(true);
      this.recoveryMessage = "Sessão recuperada após interação do usuário.";
      this.logger.record("info", "manual-recovery-succeeded");
    } catch {
      this.recoveryMessage = "A recuperação falhou. Reinicie a sessão manualmente.";
      this.logger.record("error", "manual-recovery-failed");
    }
    this.notify();
  }

  applyPwaUpdate(): void {
    this.pwaUpdate.apply();
  }

  checkPwaUpdate(): Promise<PwaUpdateStatus> {
    return this.pwaUpdate.check();
  }

  getState(): LifecycleSnapshot {
    return Object.freeze({
      visibility: this.windowLike.document.visibilityState,
      focused: this.focused,
      online: this.online,
      wakeLock: this.wakeLockStatus,
      pwaUpdate: this.pwaUpdateStatus,
      interactionRequired: this.engine.getState().requiresUserGesture,
      recoveryMessage: this.recoveryMessage,
      engine: this.engine.getState()
    });
  }

  getLogs() {
    return this.logger.snapshot();
  }

  async dispose(): Promise<void> {
    if (!this.attached) return;
    this.attached = false;
    const documentLike = this.windowLike.document;
    documentLike.removeEventListener("visibilitychange", this.visibilityListener);
    this.windowLike.removeEventListener("pagehide", this.pageHideListener);
    this.windowLike.removeEventListener("pageshow", this.pageShowListener);
    this.windowLike.removeEventListener("freeze", this.freezeListener);
    this.windowLike.removeEventListener("resume", this.resumeListener);
    this.windowLike.removeEventListener("focus", this.focusListener);
    this.windowLike.removeEventListener("blur", this.blurListener);
    this.windowLike.removeEventListener("online", this.onlineListener);
    this.windowLike.removeEventListener("offline", this.offlineListener);
    this.windowLike.navigator.mediaDevices?.removeEventListener("devicechange", this.deviceChangeListener);
    this.unsubscribeEngine?.();
    this.unsubscribeEngine = undefined;
    await this.wakeLock.release();
    this.mediaSession.dispose();
    this.pwaUpdate.dispose();
    this.logger.record("info", "lifecycle-disposed");
    this.notify();
    this.listeners.clear();
  }

  private async handleVisibilityChange(): Promise<void> {
    const visible = this.windowLike.document.visibilityState === "visible";
    this.logger.record("info", "visibility-change", { visible });
    if (!visible) {
      await this.wakeLock.release();
      this.notify();
      return;
    }
    const snapshot = this.engine.getState();
    if (snapshot.state === "running") await this.wakeLock.acquire();
    if (snapshot.state === "interrupted" && snapshot.desiredPlayback && snapshot.pauseReason === "external") {
      try {
        await this.engine.recover(false);
        this.recoveryMessage = "Áudio retomado após retorno ao primeiro plano.";
      } catch {
        this.recoveryMessage = "Toque em recuperar para liberar novamente o áudio.";
      }
    }
    this.notify();
  }

  private handlePageHide(): void {
    const snapshot = this.engine.getState();
    if (snapshot.desiredPlayback && snapshot.configuration !== undefined) {
      const persisted = {
        interruptedAt: Date.now(),
        configuration: snapshot.configuration,
        remainingSeconds: snapshot.remainingSeconds
      };
      this.windowLike.sessionStorage.setItem(RELOAD_MARKER, JSON.stringify(persisted));
      this.logger.record("warn", "session-marked-for-reload-recovery");
    }
  }

  private async handlePageShow(): Promise<void> {
    this.logger.record("info", "page-show");
    await this.handleVisibilityChange();
  }

  private handleFreeze(): void {
    this.logger.record("warn", "page-freeze");
    this.handlePageHide();
  }

  private async handleResumeEvent(): Promise<void> {
    this.logger.record("info", "page-resume");
    await this.handleVisibilityChange();
  }

  private handleFocus(focused: boolean): void {
    this.focused = focused;
    this.logger.record("info", focused ? "window-focus" : "window-blur");
    this.notify();
  }

  private handleOnline(online: boolean): void {
    this.online = online ? "online" : "offline";
    this.logger.record("info", online ? "network-online" : "network-offline");
    this.notify();
  }

  private handleDeviceChange(): void {
    const snapshot = this.engine.getState();
    this.recoveryMessage =
      snapshot.state === "running"
        ? "A saída de áudio pode ter mudado. Confirme os fones e reinicie se necessário."
        : "Dispositivo de áudio alterado.";
    this.logger.record("warn", "media-device-change");
    this.notify();
  }

  private async handleEngineEvent(event: AudioEngineEvent): Promise<void> {
    this.logger.record("debug", `engine-${event.type}`);
    const snapshot = this.engine.getState();
    const active = snapshot.state === "running" || snapshot.state === "starting" || snapshot.state === "resuming";
    this.pwaUpdate.setSessionActive(active);
    this.mediaSession.updatePlaybackState();
    if (event.type === "sessionstart" || event.type === "resume" || event.type === "recovered") {
      if (this.windowLike.document.visibilityState === "visible") await this.wakeLock.acquire();
    }
    if (event.type === "pause" || event.type === "stop" || event.type === "autostop") {
      await this.wakeLock.release();
    }
    if (event.type === "interactionrequired") this.recoveryMessage = event.message;
    if (event.type === "externalsuspension") {
      this.recoveryMessage = "O navegador suspendeu o áudio. A recuperação será tentada ao retornar.";
    }
    this.notify();
  }

  private restoreReloadMarker(): void {
    const marker = this.windowLike.sessionStorage.getItem(RELOAD_MARKER);
    if (marker === null) return;
    this.windowLike.sessionStorage.removeItem(RELOAD_MARKER);
    this.recoveryMessage = "A sessão anterior foi interrompida por recarregamento. Reinicie manualmente.";
    this.logger.record("warn", "reload-interruption-detected");
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}
