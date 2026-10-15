import { it, expect } from "vitest";
import {
  profileSchema,
  commandSchema,
  scenarioSchema,
} from "../src/lib/validation";
import { defaultProfile, scenarios } from "../src/lib/domain";
it("přijme výcvikový profil a všechny výchozí scénáře", () => {
  expect(profileSchema.safeParse(defaultProfile).success).toBe(true);
  for (const s of scenarios)
    expect(scenarioSchema.safeParse(s).success).toBe(true);
});
it("odmítne záměnu ppm a % LEL", () => {
  const p = structuredClone(defaultProfile);
  p.thresholds.CO.unit = "% LEL";
  expect(profileSchema.safeParse(p).success).toBe(false);
});
it("odmítne neplatný interval STEL, meze O₂ a pořadí prahů", () => {
  for (const edit of [
    (p: typeof defaultProfile) => (p.stelMinutes = 1),
    (p: typeof defaultProfile) => (p.thresholds.O2.high = 20),
    (p: typeof defaultProfile) => (p.thresholds.CO.low = 300),
  ]) {
    const p = structuredClone(defaultProfile);
    edit(p);
    expect(profileSchema.safeParse(p).success).toBe(false);
  }
});
it("odmítne NaN, neznámý plyn, záporný čas a libovolný profil v příkazu", () => {
  const valid = { type: "target", gas: "CO", target: 150, duration: 60 };
  expect(commandSchema.safeParse(valid).success).toBe(true);
  for (const value of [
    { ...valid, target: NaN },
    { ...valid, gas: "CH4" },
    { ...valid, duration: -1 },
    { type: "profile", profile: defaultProfile },
  ])
    expect(commandSchema.safeParse(value).success).toBe(false);
});
