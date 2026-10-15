export const gases = ["O2", "CO", "H2S", "LEL"] as const;
export type Gas = (typeof gases)[number];
export type Values = Record<Gas, number>;
export const clean: Values = { O2: 20.9, CO: 0, H2S: 0, LEL: 0 };
export const gasInfo = {
  O2: { label: "Kyslík", symbol: "O₂", unit: "% obj.", max: 30, step: 0.1 },
  CO: { label: "Oxid uhelnatý", symbol: "CO", unit: "ppm", max: 500, step: 1 },
  H2S: { label: "Sulfan", symbol: "H₂S", unit: "ppm", max: 100, step: 1 },
  LEL: {
    label: "Hořlavé plyny",
    symbol: "LEL",
    unit: "% LEL",
    max: 100,
    step: 1,
  },
};
export type Threshold = {
  low: number;
  high: number;
  twa?: number;
  stel?: number;
  unit: string;
  source: string;
  verifiedAt: string | null;
};
export type ProfileConfig = {
  name: string;
  description: string;
  model: string;
  thresholds: Record<Gas, Threshold>;
  stelMinutes: number;
  twaMethod: "rolling8h";
  stelMethod: "fixedWindow";
  latching: boolean;
  lowAcknowledge: boolean;
  intelliFlash: boolean;
  simulationMode: "training";
  source: string;
  verifiedAt: string | null;
};
export const defaultProfile: ProfileConfig = {
  name: "Ukázkový výcvikový profil",
  description:
    "Výcvikové prahy, nikoliv potvrzená konfigurace konkrétního přístroje ani české hygienické limity.",
  model: "GasAlertMicroClip X3 – simulace",
  thresholds: {
    O2: {
      low: 19.5,
      high: 23.5,
      unit: "% obj.",
      source: "Ukázková výcviková volba",
      verifiedAt: null,
    },
    CO: {
      low: 35,
      high: 200,
      twa: 35,
      stel: 50,
      unit: "ppm",
      source: "Ukázková výcviková volba",
      verifiedAt: null,
    },
    H2S: {
      low: 10,
      high: 15,
      twa: 10,
      stel: 15,
      unit: "ppm",
      source: "Ukázková výcviková volba",
      verifiedAt: null,
    },
    LEL: {
      low: 10,
      high: 20,
      unit: "% LEL",
      source: "Ukázková výcviková volba",
      verifiedAt: null,
    },
  },
  stelMinutes: 15,
  twaMethod: "rolling8h",
  stelMethod: "fixedWindow",
  latching: true,
  lowAcknowledge: true,
  intelliFlash: true,
  simulationMode: "training",
  source: "Výcvikový profil; není nastavením konkrétního detektoru.",
  verifiedAt: null,
};
export type AlarmKind =
  "LOW" | "HIGH" | "TWA" | "STEL" | "OL" | "SENSOR ERROR" | "LOW BATTERY";
export type Alarm = { gas: Gas | "BAT"; kind: AlarmKind };
export type AlarmState = {
  active: Alarm[];
  display: Alarm[];
  muted: string[];
  cadence: "none" | "slow" | "fast" | "multi" | "battery";
  audible: boolean;
  multi: boolean;
};
export type Segment = {
  start: number;
  end: number;
  co: number;
  h2s: number;
  coEnd?: number;
  h2sEnd?: number;
  coValid: boolean;
  h2sValid: boolean;
};
export type Exposure = {
  segments: Segment[];
  max: Values;
  minO2: number;
  started: number;
  incomplete: boolean;
};
export type ExposureReadings = {
  twa: { CO: number; H2S: number };
  stel: { CO: number; H2S: number };
  max: Values;
  minO2: number;
  incomplete: boolean;
};
export type Ramp = {
  from: number;
  target: number;
  start: number;
  duration: number;
};
export type Environment = {
  values: Values;
  ramps: Partial<Record<Gas, Ramp>>;
  faults: Gas[];
  battery: number;
  simTime: number;
  speed: number;
  status: "ready" | "running" | "paused" | "ended";
  cycle: number;
  profile: ProfileConfig;
  exposureMode: "activation" | "cycle";
};
export type DeviceState = {
  active: boolean;
  foreground: boolean;
  exposure: Exposure;
  alarms: AlarmState;
};
export type DetectorSnapshot = {
  serverAt: number;
  status: Environment["status"];
  cycle: number;
  simTime: number;
  speed: number;
  values: Values;
  faults: Gas[];
  battery: number;
  active: boolean;
  alarms: AlarmState;
  exposure: ExposureReadings;
  intelliFlash: boolean;
};
export type InstructorSnapshot = Environment & {
  id: string;
  code: string;
  name: string;
  serverAt: number;
  participants: {
    id: string;
    label: string;
    online: boolean;
    foreground: boolean;
    active: boolean;
    alarms: AlarmState;
    incomplete: boolean;
  }[];
};
export type ScenarioConfig = {
  name: string;
  description: string;
  targets: Values;
  duration: number;
  faults: Gas[];
};
export const scenarios: ScenarioConfig[] = [
  {
    name: "Čisté prostředí",
    description: "Výcvikový návrat do výchozích hodnot.",
    targets: { ...clean },
    duration: 0,
    faults: [],
  },
  {
    name: "CO v kotelně",
    description: "Výcvikový růst CO; nejde o fyzikální model havárie.",
    targets: { ...clean, CO: 250 },
    duration: 120,
    faults: [],
  },
  {
    name: "Nedostatek kyslíku",
    description: "Výcvikový pokles kyslíku.",
    targets: { ...clean, O2: 17 },
    duration: 90,
    faults: [],
  },
  {
    name: "Únik hořlavého plynu",
    description: "Výcvikový růst % LEL bez převodu na objem plynu.",
    targets: { ...clean, LEL: 35 },
    duration: 90,
    faults: [],
  },
  {
    name: "Únik H₂S",
    description: "Výcvikový růst sulfanu.",
    targets: { ...clean, H2S: 25 },
    duration: 90,
    faults: [],
  },
  {
    name: "Kombinované nebezpečí",
    description: "Uměle zvolený souběh více nebezpečí.",
    targets: { O2: 18, CO: 250, H2S: 20, LEL: 30 },
    duration: 120,
    faults: [],
  },
  {
    name: "Porucha senzoru",
    description: "Výcviková závada kanálu CO.",
    targets: { ...clean },
    duration: 0,
    faults: ["CO"],
  },
  {
    name: "CO v podzemní garáži",
    description:
      "Výcvik: postupný růst CO na 220 ppm za 120 s. Sledujte přechod LOW → HIGH podle zvoleného profilu; název není modelem skutečné garáže.",
    targets: { ...clean, CO: 220 },
    duration: 120,
    faults: [],
  },
  {
    name: "Agregát v uzavřeném prostoru",
    description:
      "Výcvik: CO 350 ppm a O₂ 19 % za 180 s. Uměle zvolený souběh toxického plynu a poklesu kyslíku pro multigas alarm.",
    targets: { ...clean, CO: 350, O2: 19 },
    duration: 180,
    faults: [],
  },
  {
    name: "Prostor obohacený kyslíkem",
    description:
      "Výcvik: růst O₂ na 25 % obj. za 45 s. Procvičení horní alarmové meze kyslíku bez změny ostatních kanálů.",
    targets: { ...clean, O2: 25 },
    duration: 45,
    faults: [],
  },
  {
    name: "Nebezpečná atmosféra v šachtě",
    description:
      "Výcvik: O₂ 16 % a H₂S 30 ppm za 60 s. Kombinovaný alarm při uměle zvoleném poklesu kyslíku a růstu sulfanu.",
    targets: { ...clean, O2: 16, H2S: 30 },
    duration: 60,
    faults: [],
  },
  {
    name: "Atmosféra v prostoru ČOV",
    description:
      "Výcvik: H₂S 18 ppm a LEL 18 % za 90 s. Dva různé alarmující kanály; fyzikální vazba koncentrací se nepředpokládá.",
    targets: { ...clean, H2S: 18, LEL: 18 },
    duration: 90,
    faults: [],
  },
  {
    name: "Pomalý únik hořlavého plynu",
    description:
      "Výcvik: LEL roste na 15 % během 300 s. Pozvolný přechod přes LOW ukázkového profilu; bez určení konkrétního plynu.",
    targets: { ...clean, LEL: 15 },
    duration: 300,
    faults: [],
  },
  {
    name: "Rychlý únik hořlavého plynu",
    description:
      "Výcvik: LEL roste na 60 % během 30 s. Rychlá eskalace alarmu v porovnání s pomalým únikem; nejde o výpočet výbušnosti prostoru.",
    targets: { ...clean, LEL: 60 },
    duration: 30,
    faults: [],
  },
  {
    name: "Simulované odvětrání",
    description:
      "Výcvik: z aktuálních hodnot návrat k O₂ 20,9 % a ostatním kanálům 0 za 120 s. Použijte po jiném scénáři; expozice a alarmová paměť zůstávají zachované.",
    targets: { ...clean },
    duration: 120,
    faults: [],
  },
  {
    name: "Dlouhodobá expozice CO – STEL a TWA",
    description:
      "Výcvik: náběh CO na 80 ppm za 30 s a následné udržování. Expozici nechte dál běžet; STEL/TWA závisí na profilu a délce simulačního času, nikoliv jen na dosažení cíle.",
    targets: { ...clean, CO: 80 },
    duration: 30,
    faults: [],
  },
  {
    name: "Překročení rozsahu CO",
    description:
      "Výcvik: CO roste na 650 ppm za 30 s, nad rozsahem 500 ppm se zobrazí OL. Rozlišení číselného alarmu a nadrozsahu.",
    targets: { ...clean, CO: 650 },
    duration: 30,
    faults: [],
  },
  {
    name: "Překročení rozsahu H₂S",
    description:
      "Výcvik: H₂S roste na 130 ppm za 30 s, nad rozsahem 100 ppm se zobrazí OL. Hodnoty jsou výhradně simulované.",
    targets: { ...clean, H2S: 130 },
    duration: 30,
    faults: [],
  },
  {
    name: "Porucha senzoru hořlavých plynů",
    description:
      "Výcvik: závada kanálu LEL při normálních ostatních hodnotách. Kanál zobrazuje Err; jeho číslo nelze vykládat jako platnou simulovanou koncentraci.",
    targets: { ...clean },
    duration: 0,
    faults: ["LEL"],
  },
];
