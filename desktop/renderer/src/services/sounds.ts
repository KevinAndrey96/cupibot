import { Howl } from "howler";
import { assetUrl } from "../utils/asset-url";

export type SoundId =
  | "click"
  | "select"
  | "start"
  | "stop"
  | "success"
  | "error"
  | "complete"
  | "toggle"
  | "notify"
  | "open";

const SOUND_FILES: Record<SoundId, string> = {
  click: assetUrl("sounds/click.ogg"),
  select: assetUrl("sounds/select.ogg"),
  start: assetUrl("sounds/start.ogg"),
  stop: assetUrl("sounds/stop.ogg"),
  success: assetUrl("sounds/success.ogg"),
  error: assetUrl("sounds/error.ogg"),
  complete: assetUrl("sounds/complete.ogg"),
  toggle: assetUrl("sounds/toggle.ogg"),
  notify: assetUrl("sounds/notify.ogg"),
  open: assetUrl("sounds/open.ogg"),
};

const VOLUME: Record<SoundId, number> = {
  click: 0.35,
  select: 0.4,
  start: 0.55,
  stop: 0.45,
  success: 0.6,
  error: 0.55,
  complete: 0.5,
  toggle: 0.4,
  notify: 0.45,
  open: 0.35,
};

const STORAGE_KEY = "cupibot-sounds-enabled";

class SoundManager {
  private enabled = true;
  private readonly cache = new Map<SoundId, Howl>();

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored !== null) {
        this.enabled = stored === "true";
      }
    } catch {
      this.enabled = true;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // ignore storage errors
    }
  }

  play(id: SoundId): void {
    if (!this.enabled) {
      return;
    }

    let howl = this.cache.get(id);

    if (!howl) {
      howl = new Howl({
        src: [SOUND_FILES[id]],
        volume: VOLUME[id],
        preload: true,
      });
      this.cache.set(id, howl);
    }

    howl.play();
  }
}

export const soundManager = new SoundManager();
