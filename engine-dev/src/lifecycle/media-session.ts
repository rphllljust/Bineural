import type { AudioEngine } from "../audio/audio-engine.js";
import type { NavigatorWithOptionalFeatures } from "./types.js";

interface WindowWithMediaMetadata extends Window {
  MediaMetadata?: typeof MediaMetadata;
}

export class MediaSessionController {
  constructor(
    private readonly navigatorLike: NavigatorWithOptionalFeatures,
    private readonly engine: AudioEngine
  ) {}

  configure(): void {
    const mediaSession = this.navigatorLike.mediaSession;
    if (mediaSession === undefined) return;
    const browserWindow = window as WindowWithMediaMetadata;
    if (browserWindow.MediaMetadata !== undefined) {
      mediaSession.metadata = new browserWindow.MediaMetadata({
        title: "Sessão binaural",
        artist: "Binaural Flow",
        album: "Processamento local"
      });
    }
    mediaSession.setActionHandler("play", () => {
      const snapshot = this.engine.getState();
      if (snapshot.state === "paused") void this.engine.resume();
      else if (snapshot.state === "interrupted" || snapshot.state === "interaction-required") {
        void this.engine.recover(true);
      }
    });
    mediaSession.setActionHandler("pause", () => {
      if (this.engine.getState().state === "running") void this.engine.pause();
    });
    mediaSession.setActionHandler("stop", () => {
      void this.engine.stop();
    });
    this.updatePlaybackState();
  }

  updatePlaybackState(): void {
    const mediaSession = this.navigatorLike.mediaSession;
    if (mediaSession === undefined) return;
    const state = this.engine.getState().state;
    mediaSession.playbackState = state === "running" ? "playing" : state === "paused" ? "paused" : "none";
  }

  dispose(): void {
    const mediaSession = this.navigatorLike.mediaSession;
    if (mediaSession === undefined) return;
    mediaSession.setActionHandler("play", null);
    mediaSession.setActionHandler("pause", null);
    mediaSession.setActionHandler("stop", null);
    mediaSession.playbackState = "none";
    mediaSession.metadata = null;
  }
}
