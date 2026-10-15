import type { AlarmState } from "./domain";

type Vibrate = (pattern: number | number[]) => boolean;
// Výcvikové rytmy, nikoliv změřená reprodukce vibrací originálního přístroje.
const rhythms = {
  slow: { pattern: [250], period: 1000 },
  fast: { pattern: [140, 100, 140], period: 600 },
  multi: { pattern: [250, 150, 120, 100, 120], period: 1000 },
  battery: { pattern: [70, 100, 70], period: 9000 },
};

export class AlarmVibration {
  private timer: ReturnType<typeof setInterval> | null = null;
  private signature = "none";
  private blocked = false;
  private readonly vibrate: Vibrate | null;

  constructor(vibrate?: Vibrate | null) {
    this.vibrate =
      vibrate === undefined
        ? typeof navigator !== "undefined" &&
          typeof navigator.vibrate === "function"
          ? (pattern) => navigator.vibrate(pattern)
          : null
        : vibrate;
  }

  get supported() {
    return this.vibrate !== null;
  }

  private pulse(pattern: number | number[]) {
    try {
      return this.vibrate?.(pattern) === true;
    } catch {
      return false;
    }
  }

  activate() {
    this.blocked = !this.pulse(60);
    return !this.blocked;
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.signature = "none";
    this.pulse(0);
  }

  update(alarm: AlarmState, enabled: boolean) {
    // Potvrzení zvuku LOW nesmí zrušit vibrační alarm.
    const key = enabled && alarm.display.length ? alarm.cadence : "none";
    if (key === this.signature || (key !== "none" && this.blocked)) return;
    this.stop();
    if (key === "none" || !this.supported || this.blocked) return;
    this.signature = key;
    const rhythm = rhythms[key];
    const pulse = () => {
      if (!this.pulse([...rhythm.pattern])) {
        this.blocked = true;
        this.stop();
      }
    };
    pulse();
    if (!this.blocked) this.timer = setInterval(pulse, rhythm.period);
  }
}
