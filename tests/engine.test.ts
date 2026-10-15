import { describe, it, expect } from "vitest";
import {
  addExposure,
  advance,
  emptyAlarms,
  emptyExposure,
  evaluate,
  exposures,
  setTarget,
} from "../src/lib/engine";
import { clean, defaultProfile, Environment } from "../src/lib/domain";
const profile = () => structuredClone(defaultProfile);
const reading = () => exposures(emptyExposure(), 0, 15);
const environment = (): Environment => ({
  values: { ...clean },
  ramps: {},
  faults: [],
  battery: 100,
  simTime: 0,
  speed: 1,
  status: "running",
  cycle: 1,
  profile: profile(),
  exposureMode: "activation",
});
describe("Alarmový engine", () => {
  it("TWA/STEL vyžadují reset expozice a Err lze akusticky potvrdit", () => {
    const p = profile(),
      r = reading();
    r.twa.CO = 40;
    r.stel.CO = 60;
    const alarm = evaluate(clean, [], 100, p, r);
    const acknowledged = evaluate(clean, [], 100, p, reading(), alarm, true);
    expect(acknowledged.display).toContainEqual({ gas: "CO", kind: "TWA" });
    expect(acknowledged.display).toContainEqual({ gas: "CO", kind: "STEL" });
    expect(
      evaluate(clean, ["CO"], 100, p, reading(), emptyAlarms(), true).audible,
    ).toBe(false);
  });
  it("rozlišuje normální, LOW a HIGH včetně přesné hranice", () => {
    const p = profile();
    expect(
      evaluate({ ...clean, CO: 35 }, [], 100, p, reading()).display,
    ).toEqual([]);
    expect(evaluate({ ...clean, CO: 36 }, [], 100, p, reading()).cadence).toBe(
      "slow",
    );
    expect(evaluate({ ...clean, CO: 201 }, [], 100, p, reading()).cadence).toBe(
      "fast",
    );
  });
  it("hlídá kyslík z obou stran", () => {
    expect(
      evaluate({ ...clean, O2: 19 }, [], 100, profile(), reading()).display,
    ).toContainEqual({ gas: "O2", kind: "LOW" });
    expect(
      evaluate({ ...clean, O2: 24 }, [], 100, profile(), reading()).display,
    ).toContainEqual({ gas: "O2", kind: "HIGH" });
  });
  it("označí překročení rozsahu a poruchu senzoru", () => {
    expect(
      evaluate({ ...clean, CO: 501 }, [], 100, profile(), reading()).display,
    ).toContainEqual({ gas: "CO", kind: "OL" });
    expect(
      evaluate({ ...clean, CO: 300 }, ["CO"], 100, profile(), reading())
        .display,
    ).toEqual([{ gas: "CO", kind: "SENSOR ERROR" }]);
  });
  it("přepne více plynů a nízkou baterii", () => {
    const a = evaluate(
      { ...clean, CO: 100, H2S: 20 },
      [],
      100,
      profile(),
      reading(),
    );
    expect(a.multi).toBe(true);
    expect(a.cadence).toBe("multi");
    expect(evaluate(clean, [], 8, profile(), reading()).cadence).toBe(
      "battery",
    );
  });
  it("zachová latching HIGH až do normálu a potvrzení", () => {
    const p = profile(),
      high = evaluate({ ...clean, CO: 250 }, [], 100, p, reading());
    const low = evaluate(
      { ...clean, CO: 80 },
      [],
      100,
      p,
      reading(),
      high,
      true,
    );
    expect(low.display).toContainEqual({ gas: "CO", kind: "HIGH" });
    const safe = evaluate(clean, [], 100, p, reading(), low);
    expect(safe.display.length).toBeGreaterThan(0);
    expect(evaluate(clean, [], 100, p, reading(), safe, true).display).toEqual(
      [],
    );
  });
  it("bez latching alarm při návratu odezní", () => {
    const p = profile();
    p.latching = false;
    const high = evaluate({ ...clean, CO: 250 }, [], 100, p, reading());
    expect(evaluate(clean, [], 100, p, reading(), high).display).toEqual([]);
  });
  it("potvrzuje jen zvuk LOW CO/H₂S/LEL, eskalace obnoví sirénu", () => {
    const p = profile(),
      v = { ...clean, CO: 60 };
    const low = evaluate(v, [], 100, p, reading(), emptyAlarms(), true);
    expect(low.audible).toBe(false);
    expect(low.display).toHaveLength(1);
    const high = evaluate({ ...v, CO: 250 }, [], 100, p, reading(), low);
    expect(high.audible).toBe(true);
    expect(high.cadence).toBe("fast");
    expect(
      evaluate({ ...clean, O2: 18 }, [], 100, p, reading(), emptyAlarms(), true)
        .audible,
    ).toBe(true);
  });
  it("TWA a STEL obnoví zvuk po potvrzení LOW", () => {
    const p = profile(),
      v = { ...clean, CO: 60 },
      low = evaluate(v, [], 100, p, reading(), emptyAlarms(), true);
    const e = reading();
    e.twa.CO = 40;
    e.stel.CO = 60;
    const next = evaluate(v, [], 100, p, e, low);
    expect(next.audible).toBe(true);
    expect(next.display).toContainEqual({ gas: "CO", kind: "TWA" });
    expect(next.display).toContainEqual({ gas: "CO", kind: "STEL" });
  });
});
describe("Skutečná časová expozice", () => {
  it("integruje lineární segment a přesně ořízne jeho část ve STEL", () => {
    const e = emptyExposure();
    addExposure(e, 0, 600, { ...clean, CO: 0 }, [], { ...clean, CO: 120 });
    expect(exposures(e, 600, 5).stel.CO).toBeCloseTo(90);
    expect(exposures(e, 600, 15).twa.CO).toBeCloseTo(1.25);
    expect(e.max.CO).toBe(120);
  });
  it("slučuje konstantní úseky a zachovává dávku", () => {
    const e = emptyExposure();
    for (let i = 0; i < 900; i++)
      addExposure(e, i, i + 1, { ...clean, CO: 100 }, []);
    expect(e.segments).toHaveLength(1);
    expect(exposures(e, 900, 15).stel.CO).toBe(100);
  });
  it("počítá dávku / 8 h a dávku / 15 min od aktivace", () => {
    const e = emptyExposure();
    addExposure(e, 0, 900, { ...clean, CO: 160, H2S: 16 }, []);
    const r = exposures(e, 900, 15);
    expect(r.stel.CO).toBe(160);
    expect(r.twa.CO).toBe(5);
    expect(r.stel.H2S).toBe(16);
    expect(r.twa.H2S).toBe(0.5);
  });
  it("ořízne segmenty přesně na hranici okna", () => {
    const e = emptyExposure();
    addExposure(e, 0, 600, { ...clean, CO: 100 }, []);
    addExposure(e, 600, 1200, clean, []);
    expect(exposures(e, 1200, 15).stel.CO).toBeCloseTo(100 / 3);
  });
  it("udržuje historii při resetu prostředí", () => {
    const e = emptyExposure();
    addExposure(e, 0, 900, { ...clean, CO: 100 }, []);
    addExposure(e, 900, 901, clean, []);
    expect(exposures(e, 901, 15).twa.CO).toBeCloseTo(3.125);
    expect(e.max.CO).toBe(100);
  });
  it("porucha senzoru se neprezentuje jako úplná expozice", () => {
    const e = emptyExposure();
    addExposure(e, 0, 900, { ...clean, CO: 100 }, ["CO"]);
    expect(exposures(e, 900, 15).incomplete).toBe(true);
    expect(exposures(e, 900, 15).stel.CO).toBe(0);
  });
  it("každý účastník má vlastní dobu expozice", () => {
    const a = emptyExposure(),
      b = emptyExposure(600);
    addExposure(a, 0, 900, { ...clean, CO: 100 }, []);
    addExposure(b, 600, 900, { ...clean, CO: 100 }, []);
    expect(exposures(a, 900, 15).stel.CO).toBe(100);
    expect(exposures(b, 900, 15).stel.CO).toBeCloseTo(100 / 3);
  });
});
describe("Serverový vývoj koncentrací", () => {
  it("lineárně roste 0 → 180 za 120 s a končí přesně na cíli", () => {
    const e = environment();
    setTarget(e, "CO", 180, 120);
    advance(e, 60);
    expect(e.values.CO).toBe(90);
    advance(e, 60);
    expect(e.values.CO).toBe(180);
    expect(e.ramps.CO).toBeUndefined();
  });
  it("pokles, pozastavení, pokračování a udržování", () => {
    const e = environment();
    setTarget(e, "O2", 16.9, 100);
    advance(e, 50);
    expect(e.values.O2).toBeCloseTo(18.9);
    e.status = "paused";
    advance(e, 100);
    expect(e.simTime).toBe(50);
    e.status = "running";
    advance(e, 25);
    expect(e.values.O2).toBeCloseTo(17.9);
    e.ramps = {};
    advance(e, 100);
    expect(e.values.O2).toBeCloseTo(17.9);
  });
  it("odděluje simulační a skutečný čas", () => {
    const e = environment();
    e.speed = 10;
    setTarget(e, "CO", 150, 60);
    advance(e, 3);
    expect(e.simTime).toBe(30);
    expect(e.values.CO).toBe(75);
  });
  it("okamžitá změna ruší předchozí rampu", () => {
    const e = environment();
    setTarget(e, "CO", 180, 120);
    setTarget(e, "CO", 20, 0);
    advance(e, 60);
    expect(e.values.CO).toBe(20);
  });
});
