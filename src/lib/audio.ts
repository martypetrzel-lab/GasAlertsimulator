import type { AlarmState } from "./domain";
// Výcvikové rytmy rozlišují pomalou a rychlou sirénu; nejde o změřené frekvence originálu.
export class AlarmAudio {
  context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nodes = new Set<OscillatorNode>();
  private signature = "";
  async activate() {
    if (!this.context) this.context = new AudioContext();
    await this.context.resume();
    const osc = this.context.createOscillator(),
      gain = this.context.createGain();
    gain.gain.value = 0.00001;
    osc.connect(gain).connect(this.context.destination);
    osc.start();
    osc.stop(this.context.currentTime + 0.02);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        /* Již ukončený oscilátor nevyžaduje další akci. */
      }
    }
    this.nodes.clear();
    this.signature = "";
  }
  private beep(duration: number, frequency: number) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(
      frequency * 1.2,
      ctx.currentTime + duration,
    );
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    this.nodes.add(osc);
    osc.onended = () => {
      this.nodes.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.01);
  }
  update(alarm: AlarmState, enabled: boolean) {
    const key = enabled && alarm.audible ? alarm.cadence : "none";
    if (key === this.signature) return;
    this.stop();
    this.signature = key;
    if (key === "none") return;
    let tick = 0;
    const pulse = () => {
      const fast =
        key === "fast" || (key === "multi" && Math.floor(tick / 20) % 2 === 1);
      if (key === "battery") {
        if (tick % 90 < 20 && tick % 2 === 0) this.beep(0.07, 2000);
      } else {
        const period = fast ? 3 : 10;
        if (tick % period === 0)
          this.beep(fast ? 0.13 : 0.3, fast ? 2300 : 1800);
      }
      tick++;
    };
    pulse();
    this.timer = setInterval(pulse, 100);
  }
}
