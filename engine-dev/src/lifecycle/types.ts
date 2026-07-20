import type { AudioEngineSnapshot } from "../audio/types.js";

export type WakeLockStatus = "unsupported" | "released" | "acquiring" | "active" | "denied";
export type OnlineStatus = "online" | "offline";
export type PwaUpdateStatus = "unsupported" | "idle" | "checking" | "available" | "deferred" | "applying";

export interface LifecycleSnapshot {
  readonly visibility: DocumentVisibilityState;
  readonly focused: boolean;
  readonly online: OnlineStatus;
  readonly wakeLock: WakeLockStatus;
  readonly pwaUpdate: PwaUpdateStatus;
  readonly interactionRequired: boolean;
  readonly recoveryMessage: string;
  readonly engine: AudioEngineSnapshot;
}

export interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
  removeEventListener(type: "release", listener: () => void): void;
}

export interface WakeLockManagerLike {
  request(type: "screen"): Promise<WakeLockSentinelLike>;
}

export interface NavigatorWithOptionalFeatures {
  readonly onLine: boolean;
  readonly wakeLock?: WakeLockManagerLike;
  readonly mediaSession?: MediaSessionLike;
  readonly serviceWorker?: ServiceWorkerContainerLike;
  readonly mediaDevices?: MediaDevicesLike;
}

export interface MediaDevicesLike {
  addEventListener(type: "devicechange", listener: () => void): void;
  removeEventListener(type: "devicechange", listener: () => void): void;
}

export interface MediaSessionMetadataLike {
  title: string;
  artist: string;
  album: string;
}

export type MediaSessionAction = "play" | "pause" | "stop";

export interface MediaSessionLike {
  metadata: MediaMetadata | null;
  playbackState: MediaSessionPlaybackState;
  setActionHandler(action: MediaSessionAction, handler: (() => void) | null): void;
}

export interface ServiceWorkerLike {
  state: ServiceWorkerState;
  postMessage(message: Readonly<Record<string, string>>): void;
  addEventListener(type: "statechange", listener: () => void): void;
  removeEventListener(type: "statechange", listener: () => void): void;
}

export interface ServiceWorkerRegistrationLike {
  waiting: ServiceWorkerLike | null;
  installing: ServiceWorkerLike | null;
  addEventListener(type: "updatefound", listener: () => void): void;
  removeEventListener(type: "updatefound", listener: () => void): void;
  update(): Promise<void>;
}

export interface ServiceWorkerContainerLike {
  controller: ServiceWorkerLike | null;
  ready: Promise<ServiceWorkerRegistrationLike>;
  register(scriptURL: string, options?: RegistrationOptions): Promise<ServiceWorkerRegistrationLike>;
  addEventListener(type: "controllerchange", listener: () => void): void;
  removeEventListener(type: "controllerchange", listener: () => void): void;
}

export interface DocumentLike {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface WindowLike {
  readonly document: DocumentLike;
  readonly navigator: NavigatorWithOptionalFeatures;
  readonly sessionStorage: Storage;
  readonly location: Pick<Location, "reload">;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
  hasFocus(): boolean;
}

export type LifecycleListener = (snapshot: LifecycleSnapshot) => void;
