import { z } from "zod";
import { gases, gasInfo } from "./domain";
export const gasSchema = z.enum(["O2", "CO", "H2S", "LEL"]);
export const valuesSchema = z
  .object({
    O2: z.number().min(0).max(40),
    CO: z.number().min(0).max(1000),
    H2S: z.number().min(0).max(200),
    LEL: z.number().min(0).max(200),
  })
  .strict();
const threshold = z
  .object({
    low: z.number().nonnegative().max(1000),
    high: z.number().positive().max(1000),
    twa: z.number().positive().max(1000).optional(),
    stel: z.number().positive().max(1000).optional(),
    unit: z.string().max(20),
    source: z.string().min(1).max(1000),
    verifiedAt: z.iso.date().nullable(),
  })
  .refine((v) => v.low < v.high, "LOW musí být nižší než HIGH.");
export const profileSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000),
    model: z.string().min(1).max(100),
    thresholds: z.object({
      O2: threshold,
      CO: threshold,
      H2S: threshold,
      LEL: threshold,
    }),
    stelMinutes: z.number().int().min(5).max(15),
    twaMethod: z.literal("rolling8h"),
    stelMethod: z.literal("fixedWindow"),
    latching: z.boolean(),
    lowAcknowledge: z.boolean(),
    intelliFlash: z.boolean(),
    simulationMode: z.literal("training"),
    source: z.string().min(1).max(1000),
    verifiedAt: z.iso.date().nullable(),
  })
  .superRefine((p, ctx) => {
    for (const g of gases) {
      if (p.thresholds[g].unit !== gasInfo[g].unit)
        ctx.addIssue({
          code: "custom",
          message: `Nesprávná jednotka kanálu ${g}.`,
        });
      if (p.thresholds[g].high > gasInfo[g].max)
        ctx.addIssue({
          code: "custom",
          message: `HIGH ${g} přesahuje měřicí rozsah.`,
        });
    }
    for (const g of ["CO", "H2S"] as const)
      if (!p.thresholds[g].twa || !p.thresholds[g].stel)
        ctx.addIssue({
          code: "custom",
          message: "CO a H₂S vyžadují TWA a STEL.",
        });
    if (p.thresholds.O2.low >= 20.9 || p.thresholds.O2.high <= 20.9)
      ctx.addIssue({
        code: "custom",
        message: "Meze O₂ musí obklopovat 20,9 %.",
      });
  });
export const scenarioSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  targets: valuesSchema,
  duration: z.number().min(0).max(86400),
  faults: z.array(gasSchema).max(4),
});
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("target"),
    gas: gasSchema,
    target: z.number().min(0).max(1000),
    duration: z.number().min(0).max(86400),
  }),
  z.object({
    type: z.enum(["start", "pause", "resume", "reset", "hold", "end", "cycle"]),
  }),
  z.object({ type: z.literal("holdGas"), gas: gasSchema }),
  z.object({ type: z.literal("fault"), gas: gasSchema, enabled: z.boolean() }),
  z.object({ type: z.literal("battery"), value: z.number().min(0).max(100) }),
  z.object({
    type: z.literal("speed"),
    value: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(60)]),
  }),
  z.object({ type: z.literal("scenario"), scenario: scenarioSchema }),
]);
export type Command = z.infer<typeof commandSchema>;
