import {
  Alarm,
  AlarmState,
  clean,
  DeviceState,
  Environment,
  Exposure,
  ExposureReadings,
  Gas,
  gases,
  gasInfo,
  ProfileConfig,
  Values,
} from "./domain";
export const alarmKey = (a: Alarm) => `${a.gas}:${a.kind}`;
export function emptyExposure(time = 0): Exposure {
  return {
    segments: [],
    max: { ...clean },
    minO2: 20.9,
    started: time,
    incomplete: false,
  };
}
export function emptyAlarms(): AlarmState {
  return {
    active: [],
    display: [],
    muted: [],
    cadence: "none",
    audible: false,
    multi: false,
  };
}
export function newDevice(time = 0): DeviceState {
  return {
    active: false,
    foreground: true,
    exposure: emptyExposure(time),
    alarms: emptyAlarms(),
  };
}
export function addExposure(
  e: Exposure,
  start: number,
  end: number,
  v: Values,
  faults: Gas[],
  endValues: Values = v,
) {
  if (end <= start) return;
  const segment = {
    start,
    end,
    co: v.CO,
    h2s: v.H2S,
    coEnd: endValues.CO,
    h2sEnd: endValues.H2S,
    coValid: !faults.includes("CO"),
    h2sValid: !faults.includes("H2S"),
  };
  const previous = e.segments.at(-1);
  if (
    previous &&
    previous.end === start &&
    previous.co === segment.co &&
    previous.h2s === segment.h2s &&
    (previous.coEnd ?? previous.co) === segment.co &&
    (previous.h2sEnd ?? previous.h2s) === segment.h2s &&
    segment.co === segment.coEnd &&
    segment.h2s === segment.h2sEnd &&
    previous.coValid === segment.coValid &&
    previous.h2sValid === segment.h2sValid
  )
    previous.end = end;
  else e.segments.push(segment);
  while (e.segments.length && e.segments[0].end <= end - 28800)
    e.segments.shift();
  for (const g of gases)
    if (!faults.includes(g)) e.max[g] = Math.max(e.max[g], v[g], endValues[g]);
  if (!faults.includes("O2")) e.minO2 = Math.min(e.minO2, v.O2, endValues.O2);
  if (faults.includes("CO") || faults.includes("H2S")) e.incomplete = true;
}
export function exposures(
  e: Exposure,
  time: number,
  minutes: number,
): ExposureReadings {
  const avg = (gas: "CO" | "H2S", window: number) =>
    e.segments.reduce((sum, s) => {
      const left = Math.max(time - window, s.start),
        right = Math.min(time, s.end);
      if (right <= left || (gas === "CO" ? !s.coValid : !s.h2sValid))
        return sum;
      const first = gas === "CO" ? s.co : s.h2s,
        last = gas === "CO" ? (s.coEnd ?? s.co) : (s.h2sEnd ?? s.h2s);
      const slope = (last - first) / (s.end - s.start);
      return (
        sum + (right - left) * (first + slope * ((left + right) / 2 - s.start))
      );
    }, 0) / window;
  return {
    twa: { CO: avg("CO", 28800), H2S: avg("H2S", 28800) },
    stel: { CO: avg("CO", minutes * 60), H2S: avg("H2S", minutes * 60) },
    max: e.max,
    minO2: e.minO2,
    incomplete: e.incomplete,
  };
}
export function evaluate(
  v: Values,
  faults: Gas[],
  battery: number,
  p: ProfileConfig,
  e: ExposureReadings,
  previous = emptyAlarms(),
  ack = false,
): AlarmState {
  const active: Alarm[] = [];
  for (const gas of gases) {
    if (faults.includes(gas)) {
      active.push({ gas, kind: "SENSOR ERROR" });
      continue;
    }
    const t = p.thresholds[gas];
    if (v[gas] > gasInfo[gas].max || v[gas] < 0)
      active.push({ gas, kind: "OL" });
    else if (gas === "O2") {
      if (v.O2 < t.low) active.push({ gas, kind: "LOW" });
      else if (v.O2 > t.high) active.push({ gas, kind: "HIGH" });
    } else if (v[gas] > t.high) active.push({ gas, kind: "HIGH" });
    else if (v[gas] > t.low) active.push({ gas, kind: "LOW" });
    if (gas === "CO" || gas === "H2S") {
      if (t.twa && e.twa[gas] > t.twa) active.push({ gas, kind: "TWA" });
      if (t.stel && e.stel[gas] > t.stel) active.push({ gas, kind: "STEL" });
    }
  }
  if (battery <= 10) active.push({ gas: "BAT", kind: "LOW BATTERY" });
  const retained = previous.display.filter(
    (a) =>
      a.kind === "TWA" ||
      a.kind === "STEL" ||
      (p.latching && ["LOW", "HIGH", "OL"].includes(a.kind)),
  );
  const display = [
    ...new Map([...retained, ...active].map((a) => [alarmKey(a), a])).values(),
  ].filter(
    (a) =>
      !ack ||
      a.kind === "TWA" ||
      a.kind === "STEL" ||
      active.some((x) => x.gas === a.gas),
  );
  const liveKeys = active.map(alarmKey);
  let muted = previous.muted.filter((k) => liveKeys.includes(k));
  if (ack)
    muted = [
      ...new Set([
        ...muted,
        ...active.filter((a) => a.kind === "SENSOR ERROR").map(alarmKey),
      ]),
    ];
  if (ack && p.lowAcknowledge)
    muted = [
      ...new Set([
        ...muted,
        ...active
          .filter((a) => a.kind === "LOW" && a.gas !== "O2")
          .map(alarmKey),
      ]),
    ];
  const multi =
    new Set(display.filter((a) => a.gas !== "BAT").map((a) => a.gas)).size > 1;
  const fast = display.some((a) =>
    ["HIGH", "STEL", "OL", "SENSOR ERROR"].includes(a.kind),
  );
  const cadence = multi
    ? "multi"
    : fast
      ? "fast"
      : display.some((a) => a.kind !== "LOW BATTERY")
        ? "slow"
        : display.length
          ? "battery"
          : "none";
  return {
    active,
    display,
    muted,
    cadence,
    audible: display.some((a) => !muted.includes(alarmKey(a))),
    multi,
  };
}
export function advance(env: Environment, realSeconds: number) {
  if (env.status !== "running") return;
  env.simTime += realSeconds * env.speed;
  for (const g of gases) {
    const r = env.ramps[g];
    if (!r) continue;
    const fraction = Math.min(
      1,
      Math.max(0, (env.simTime - r.start) / r.duration),
    );
    env.values[g] = r.from + (r.target - r.from) * fraction;
    if (fraction >= 1) delete env.ramps[g];
  }
}
export function setTarget(
  env: Environment,
  g: Gas,
  target: number,
  duration: number,
) {
  if (duration === 0) {
    env.values[g] = target;
    delete env.ramps[g];
  } else
    env.ramps[g] = {
      from: env.values[g],
      target,
      start: env.simTime,
      duration,
    };
}
