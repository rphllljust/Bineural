import type { NavigatorWithOptionalFeatures, WakeLockSentinelLike, WakeLockStatus } from "./types.js";

export class ScreenWakeLockController {
  private sentinel: WakeLockSentinelLike | null = null;
  private status: WakeLockStatus;
  private acquiring = false;
  private readonly releaseListener = () => {
    this.sentinel = null;
    this.status = "released";
    this.onStatusChange(this.status);
  };

  constructor(
    private readonly navigatorLike: NavigatorWithOptionalFeatures,
    private readonly onStatusChange: (status: WakeLockStatus) => void
  ) {
    this.status = navigatorLike.wakeLock === undefined ? "unsupported" : "released";
  }

  getStatus(): WakeLockStatus {
    return this.status;
  }

  async acquire(): Promise<WakeLockStatus> {
    if (this.navigatorLike.wakeLock === undefined) return this.update("unsupported");
    if (this.sentinel !== null && !this.sentinel.released) return this.update("active");
    if (this.acquiring) return this.status;
    this.acquiring = true;
    this.update("acquiring");
    try {
      const sentinel = await this.navigatorLike.wakeLock.request("screen");
      this.sentinel = sentinel;
      sentinel.addEventListener("release", this.releaseListener);
      return this.update("active");
    } catch {
      this.sentinel = null;
      return this.update("denied");
    } finally {
      this.acquiring = false;
    }
  }

  async release(): Promise<WakeLockStatus> {
    if (this.sentinel === null) {
      return this.update(this.navigatorLike.wakeLock === undefined ? "unsupported" : "released");
    }
    const sentinel = this.sentinel;
    sentinel.removeEventListener("release", this.releaseListener);
    this.sentinel = null;
    try {
      if (!sentinel.released) await sentinel.release();
    } finally {
      this.update("released");
    }
    return this.status;
  }

  private update(status: WakeLockStatus): WakeLockStatus {
    this.status = status;
    this.onStatusChange(status);
    return status;
  }
}
