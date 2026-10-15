import { afterEach, describe, expect, it, vi } from "vitest";
import { AlarmVibration } from "../src/lib/vibration";
import { emptyAlarms } from "../src/lib/engine";
import type { AlarmState } from "../src/lib/domain";
const alarm = (cadence: AlarmState["cadence"] = "slow"): AlarmState => ({
  ...emptyAlarms(),
  display: [{ gas: "CO", kind: cadence === "slow" ? "LOW" : "HIGH" }],
  cadence,
  audible: true,
});
afterEach(() => vi.useRealTimers());
describe("Vibrační alarm", () => {
  it("opakuje LOW a nezastaví jej potvrzení samotného zvuku", () => {
    vi.useFakeTimers();
    const vibrate = vi.fn(() => true),
      engine = new AlarmVibration(vibrate);
    engine.update(alarm(), true);
    expect(vibrate).toHaveBeenLastCalledWith([250]);
    engine.update({ ...alarm(), audible: false, muted: ["CO:LOW"] }, true);
    vi.advanceTimersByTime(1000);
    expect(vibrate).toHaveBeenLastCalledWith([250]);
    engine.stop();
  });
  it("při HIGH přeruší starý rytmus a spustí rychlý", () => {
    vi.useFakeTimers();
    const vibrate = vi.fn(() => true),
      engine = new AlarmVibration(vibrate);
    engine.update(alarm(), true);
    vibrate.mockClear();
    engine.update(alarm("fast"), true);
    expect(vibrate.mock.calls).toEqual([[0], [[140, 100, 140]]]);
    vi.advanceTimersByTime(600);
    expect(vibrate).toHaveBeenLastCalledWith([140, 100, 140]);
    engine.stop();
  });
  it("obnovy stejného stavu nevytvářejí další časovače", () => {
    vi.useFakeTimers();
    const vibrate = vi.fn(() => true),
      engine = new AlarmVibration(vibrate);
    for (let i = 0; i < 10; i++) engine.update(alarm(), true);
    expect(vi.getTimerCount()).toBe(1);
    engine.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ztráta spojení, vypnutí nebo pozadí zruší i právě běžící vibraci", () => {
    vi.useFakeTimers();
    const vibrate = vi.fn(() => true),
      engine = new AlarmVibration(vibrate);
    engine.update(alarm("multi"), true);
    engine.update(alarm("multi"), false);
    expect(vibrate).toHaveBeenLastCalledWith(0);
    const calls = vibrate.mock.calls.length;
    vi.advanceTimersByTime(10000);
    expect(vibrate).toHaveBeenCalledTimes(calls);
    engine.update(alarm("multi"), true);
    expect(vibrate).toHaveBeenLastCalledWith([250, 150, 120, 100, 120]);
    engine.stop();
  });
  it("bez API, při odmítnutí nebo výjimce bezpečně pokračuje bez vibrací", () => {
    vi.useFakeTimers();
    const unsupported = new AlarmVibration(null);
    expect(unsupported.supported).toBe(false);
    expect(unsupported.activate()).toBe(false);
    unsupported.update(alarm(), true);
    const denied = vi.fn(() => false),
      engine = new AlarmVibration(denied);
    engine.update(alarm(), true);
    expect(vi.getTimerCount()).toBe(0);
    const count = denied.mock.calls.length;
    engine.update(alarm(), true);
    expect(denied).toHaveBeenCalledTimes(count);
    denied.mockReturnValue(true);
    expect(engine.activate()).toBe(true);
    engine.update(alarm(), true);
    expect(vi.getTimerCount()).toBe(1);
    engine.stop();
    expect(() =>
      new AlarmVibration(() => {
        throw new Error("Odmítnuto");
      }).activate(),
    ).not.toThrow();
  });
  it("po odeznění alarmu zastaví rytmus a pro baterii používá vlastní interval", () => {
    vi.useFakeTimers();
    const vibrate = vi.fn(() => true),
      engine = new AlarmVibration(vibrate);
    engine.update(alarm("battery"), true);
    expect(vibrate).toHaveBeenLastCalledWith([70, 100, 70]);
    engine.update(emptyAlarms(), true);
    expect(vibrate).toHaveBeenLastCalledWith(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
