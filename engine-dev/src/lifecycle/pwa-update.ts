import type {
  PwaUpdateStatus,
  ServiceWorkerContainerLike,
  ServiceWorkerLike,
  ServiceWorkerRegistrationLike
} from "./types.js";

export class PwaUpdateController {
  private registration: ServiceWorkerRegistrationLike | null = null;
  private status: PwaUpdateStatus;
  private activeSession = false;
  private applyRequested = false;
  private installingWorker: ServiceWorkerLike | null = null;
  private readonly updateFoundListener = () => this.handleUpdateFound();
  private readonly workerStateListener = () => this.handleWorkerState();
  private readonly controllerChangeListener = () => {
    if (!this.applyRequested || this.activeSession) return;
    this.reload();
  };

  constructor(
    private readonly serviceWorker: ServiceWorkerContainerLike | undefined,
    private readonly reload: () => void,
    private readonly onStatusChange: (status: PwaUpdateStatus) => void
  ) {
    this.status = serviceWorker === undefined ? "unsupported" : "idle";
  }

  getStatus(): PwaUpdateStatus {
    return this.status;
  }

  async register(scriptUrl = "./sw.js"): Promise<PwaUpdateStatus> {
    if (this.serviceWorker === undefined) return this.update("unsupported");
    this.registration = await this.serviceWorker.register(scriptUrl);
    this.registration.addEventListener("updatefound", this.updateFoundListener);
    this.serviceWorker.addEventListener("controllerchange", this.controllerChangeListener);
    if (this.registration.waiting !== null) this.markAvailable();
    return this.status;
  }

  async check(): Promise<PwaUpdateStatus> {
    if (this.registration === null) return this.status;
    this.update("checking");
    await this.registration.update();
    if (this.status === "checking") this.update("idle");
    return this.status;
  }

  setSessionActive(active: boolean): void {
    this.activeSession = active;
    if (active && this.status === "available") this.update("deferred");
    if (!active && this.status === "deferred") this.update("available");
  }

  apply(): PwaUpdateStatus {
    const waiting = this.registration?.waiting;
    if (waiting === null || waiting === undefined) return this.status;
    if (this.activeSession) return this.update("deferred");
    this.applyRequested = true;
    this.update("applying");
    waiting.postMessage({ type: "SKIP_WAITING" });
    return this.status;
  }

  dispose(): void {
    this.registration?.removeEventListener("updatefound", this.updateFoundListener);
    this.installingWorker?.removeEventListener("statechange", this.workerStateListener);
    this.serviceWorker?.removeEventListener("controllerchange", this.controllerChangeListener);
    this.registration = null;
    this.installingWorker = null;
  }

  private handleUpdateFound(): void {
    const worker = this.registration?.installing;
    if (worker === null || worker === undefined) return;
    this.installingWorker?.removeEventListener("statechange", this.workerStateListener);
    this.installingWorker = worker;
    worker.addEventListener("statechange", this.workerStateListener);
  }

  private handleWorkerState(): void {
    if (this.installingWorker?.state !== "installed") return;
    if (this.serviceWorker?.controller !== null) this.markAvailable();
  }

  private markAvailable(): void {
    this.update(this.activeSession ? "deferred" : "available");
  }

  private update(status: PwaUpdateStatus): PwaUpdateStatus {
    this.status = status;
    this.onStatusChange(status);
    return status;
  }
}
