import { randomInt } from "node:crypto";
import { Server } from "socket.io";
import { db, json } from "./db";
import { hash, token } from "./auth";
import {
  addExposure,
  advance,
  alarmKey,
  emptyAlarms,
  emptyExposure,
  evaluate,
  exposures,
  newDevice,
  setTarget,
} from "../src/lib/engine";
import {
  clean,
  defaultProfile,
  DetectorSnapshot,
  DeviceState,
  Environment,
  gases,
  gasInfo,
  InstructorSnapshot,
} from "../src/lib/domain";
import { Command } from "../src/lib/validation";

type Person = {
  id: string;
  label: string;
  state: DeviceState;
  sockets: Set<string>;
};
type Room = {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  env: Environment;
  people: Map<string, Person>;
  last: number;
};
export class Runtime {
  rooms = new Map<string, Room>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(public io: Server) {}
  serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
  async load() {
    const rows = await db.exercise.findMany({
      where: { status: { not: "ended" } },
      include: { participants: true },
    });
    for (const row of rows) {
      const env = row.state as unknown as Environment;
      // Po restartu není možné doložit chybějící průběh. Pokračování vyžaduje instruktora.
      if (env.status === "running") env.status = "paused";
      const room: Room = {
        id: row.id,
        code: row.code,
        name: row.name,
        ownerId: row.ownerId,
        env,
        people: new Map(),
        last: Date.now(),
      };
      for (const p of row.participants) {
        const state = p.state as unknown as DeviceState;
        state.foreground = false;
        state.exposure.incomplete = true;
        room.people.set(p.id, {
          id: p.id,
          label: p.label,
          state,
          sockets: new Set(),
        });
      }
      this.rooms.set(room.id, room);
      await this.event(room, "SERVER_RESTART", {
        message: "Cvičení pozastaveno; mezera v expozici.",
      });
      await this.save(room);
    }
  }
  async create(
    ownerId: string,
    name: string,
    profile = defaultProfile,
    exposureMode: "activation" | "cycle" = "activation",
  ) {
    const env: Environment = {
      values: { ...clean },
      ramps: {},
      faults: [],
      battery: 100,
      simTime: 0,
      speed: 1,
      status: "ready",
      cycle: 1,
      profile,
      exposureMode,
    };
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = String(randomInt(100000, 1000000));
      if (await db.exercise.findUnique({ where: { code } })) continue;
      const row = await db.exercise.create({
        data: { ownerId, name, code, state: json(env) },
      });
      const room: Room = {
        id: row.id,
        code,
        name,
        ownerId,
        env,
        people: new Map(),
        last: Date.now(),
      };
      this.rooms.set(row.id, room);
      await this.event(room, "CREATED", { profile });
      return this.instructor(room);
    }
    throw new Error("Nelze vytvořit jedinečný kód.");
  }
  owned(id: string, owner: string) {
    const room = this.rooms.get(id);
    if (!room || room.ownerId !== owner)
      throw new Error("Cvičení není dostupné.");
    return room;
  }
  async join(code: string, label: string) {
    const room = [...this.rooms.values()].find(
      (r) => r.code === code && r.env.status !== "ended",
    );
    if (!room) throw new Error("Cvičení nebylo nalezeno nebo již skončilo.");
    if (room.people.size >= 100)
      throw new Error("Kapacita cvičení je naplněna.");
    const secret = token(),
      state = newDevice(room.env.simTime);
    const row = await db.participant.create({
      data: {
        exerciseId: room.id,
        label: label || `Hasič ${room.people.size + 1}`,
        tokenHash: hash(secret),
        state: json(state),
      },
    });
    room.people.set(row.id, {
      id: row.id,
      label: row.label,
      state,
      sockets: new Set(),
    });
    await this.event(room, "JOIN", { label: row.label }, row.id);
    this.broadcast(room);
    return { token: secret, exerciseId: room.id };
  }
  async identify(secret: string) {
    const row = await db.participant.findUnique({
      where: { tokenHash: hash(secret) },
    });
    if (!row) throw new Error("Neplatné připojení.");
    let room = this.rooms.get(row.exerciseId);
    if (!room) {
      const e = await db.exercise.findUniqueOrThrow({
        where: { id: row.exerciseId },
        include: { participants: true },
      });
      room = {
        id: e.id,
        code: e.code,
        name: e.name,
        ownerId: e.ownerId,
        env: e.state as unknown as Environment,
        people: new Map(
          e.participants.map((p) => [
            p.id,
            {
              id: p.id,
              label: p.label,
              state: p.state as unknown as DeviceState,
              sockets: new Set<string>(),
            },
          ]),
        ),
        last: Date.now(),
      };
      this.rooms.set(e.id, room);
    }
    const person = room.people.get(row.id);
    if (!person) throw new Error("Účastník není dostupný.");
    return { room, person };
  }
  instructor(r: Room): InstructorSnapshot {
    return {
      ...r.env,
      id: r.id,
      code: r.code,
      name: r.name,
      serverAt: Date.now(),
      participants: [...r.people.values()].map((p) => ({
        id: p.id,
        label: p.label,
        online: !!p.sockets.size,
        foreground: p.state.foreground,
        active: p.state.active,
        alarms: p.state.alarms,
        incomplete: p.state.exposure.incomplete,
      })),
    };
  }
  detector(r: Room, p: Person): DetectorSnapshot {
    return {
      serverAt: Date.now(),
      status: r.env.status,
      cycle: r.env.cycle,
      simTime: r.env.simTime,
      speed: r.env.speed,
      values: r.env.values,
      faults: r.env.faults,
      battery: r.env.battery,
      active: p.state.active,
      alarms: p.state.alarms,
      exposure: exposures(
        p.state.exposure,
        r.env.simTime,
        r.env.profile.stelMinutes,
      ),
      intelliFlash: r.env.profile.intelliFlash,
    };
  }
  broadcast(r: Room) {
    this.io
      .to(`instructor:${r.id}`)
      .emit("instructor:state", this.instructor(r));
    for (const p of r.people.values())
      this.io
        .to(`detector:${p.id}`)
        .emit("detector:state", this.detector(r, p));
  }
  async event(r: Room, kind: string, payload: unknown, participantId?: string) {
    await db.event.create({
      data: {
        exerciseId: r.id,
        simTime: r.env.simTime,
        kind,
        participantId,
        payload: json(payload),
      },
    });
  }
  async save(r: Room, sample = false) {
    await db.$transaction([
      db.exercise.update({
        where: { id: r.id },
        data: {
          state: json(r.env),
          status: r.env.status,
          endedAt: r.env.status === "ended" ? new Date() : null,
        },
      }),
      ...[...r.people.values()].map((p) =>
        db.participant.update({
          where: { id: p.id },
          data: {
            state: json(p.state),
            lastSeen: p.sockets.size ? new Date() : undefined,
          },
        }),
      ),
      ...(sample
        ? [
            db.sample.create({
              data: {
                exerciseId: r.id,
                simTime: r.env.simTime,
                values: json(r.env.values),
              },
            }),
          ]
        : []),
    ]);
  }
  async evaluate(r: Room) {
    for (const p of r.people.values()) {
      if (!p.state.active) continue;
      for (const g of gases)
        if (!r.env.faults.includes(g))
          p.state.exposure.max[g] = Math.max(
            p.state.exposure.max[g],
            r.env.values[g],
          );
      if (!r.env.faults.includes("O2"))
        p.state.exposure.minO2 = Math.min(
          p.state.exposure.minO2,
          r.env.values.O2,
        );
      const old = p.state.alarms;
      p.state.alarms = evaluate(
        r.env.values,
        r.env.faults,
        r.env.battery,
        r.env.profile,
        exposures(p.state.exposure, r.env.simTime, r.env.profile.stelMinutes),
        old,
      );
      if (
        old.display.map(alarmKey).join() !==
        p.state.alarms.display.map(alarmKey).join()
      )
        await this.event(r, "ALARM", { alarms: p.state.alarms.display }, p.id);
    }
  }
  async tick(now = Date.now()) {
    for (const r of this.rooms.values()) {
      const delta = Math.max(0, (now - r.last) / 1000);
      r.last = now;
      if (r.env.status === "running") {
        // Dlouhá prodleva event loop není dopočítána jako věrohodná expozice.
        if (delta > 5) {
          r.env.status = "paused";
          for (const p of r.people.values()) p.state.exposure.incomplete = true;
          await this.event(r, "TIMING_GAP", { seconds: delta });
        } else {
          const finish = r.env.simTime + delta * r.env.speed;
          const boundaries = [
            ...new Set([
              ...Object.values(r.env.ramps)
                .map((ramp) => ramp.start + ramp.duration)
                .filter((t) => t > r.env.simTime && t < finish),
              finish,
            ]),
          ].sort((a, b) => a - b);
          for (const boundary of boundaries) {
            const before = r.env.simTime,
              previous = { ...r.env.values };
            advance(r.env, (boundary - before) / r.env.speed);
            for (const p of r.people.values())
              if (p.state.active)
                addExposure(
                  p.state.exposure,
                  before,
                  r.env.simTime,
                  previous,
                  r.env.faults,
                  r.env.values,
                );
          }
          await this.evaluate(r);
        }
        await this.save(r, true);
      }
      this.broadcast(r);
    }
  }
  async command(r: Room, c: Command) {
    if (r.env.status === "ended") throw new Error("Cvičení bylo ukončeno.");
    const e = r.env;
    const exposuresBeforeReset =
      c.type === "cycle"
        ? [...r.people.values()].map((p) => ({
            participantId: p.id,
            exposure: p.state.exposure,
          }))
        : undefined;
    switch (c.type) {
      case "target":
        if (
          c.target > gasInfo[c.gas].max * 2 ||
          (c.gas === "O2" && c.target > 40)
        )
          throw new Error("Cíl je mimo výcvikový rozsah.");
        setTarget(e, c.gas, c.target, c.duration);
        break;
      case "start":
        if (e.status !== "ready") throw new Error("Cvičení již bylo zahájeno.");
        e.status = "running";
        break;
      case "pause":
        if (e.status === "running") e.status = "paused";
        break;
      case "resume":
        if (e.status === "paused") e.status = "running";
        break;
      case "reset":
        e.values = { ...clean };
        e.ramps = {};
        e.faults = [];
        break;
      case "hold":
        e.ramps = {};
        break;
      case "holdGas":
        delete e.ramps[c.gas];
        break;
      case "end":
        e.status = "ended";
        e.ramps = {};
        for (const p of r.people.values()) p.state.active = false;
        break;
      case "cycle":
        e.values = { ...clean };
        e.ramps = {};
        e.faults = [];
        e.cycle++;
        for (const p of r.people.values()) {
          p.state.exposure = emptyExposure(e.simTime);
          p.state.alarms = emptyAlarms();
        }
        break;
      case "fault":
        e.faults = c.enabled
          ? [...new Set([...e.faults, c.gas])]
          : e.faults.filter((g) => g !== c.gas);
        break;
      case "battery":
        e.battery = c.value;
        break;
      case "speed":
        e.speed = c.value;
        break;
      case "scenario":
        for (const g of gases)
          setTarget(e, g, c.scenario.targets[g], c.scenario.duration);
        e.faults = c.scenario.faults;
        break;
    }
    r.last = Date.now();
    await this.evaluate(r);
    await this.event(
      r,
      "COMMAND",
      exposuresBeforeReset ? { ...c, exposuresBeforeReset } : c,
    );
    await this.save(r, true);
    this.broadcast(r);
  }
  async action(
    r: Room,
    p: Person,
    action: "activate" | "deactivate" | "ack" | "resetExposure" | "foreground",
    visible?: boolean,
  ) {
    const exposureBeforeReset =
      action === "resetExposure" ||
      (action === "activate" &&
        !p.state.active &&
        r.env.exposureMode === "activation")
        ? p.state.exposure
        : undefined;
    if (action === "foreground") p.state.foreground = visible ?? true;
    else if (r.env.status === "ended") throw new Error("Cvičení je ukončeno.");
    else if (action === "activate") {
      if (!p.state.active && r.env.exposureMode === "activation")
        p.state.exposure = emptyExposure(r.env.simTime);
      p.state.active = true;
    } else if (action === "deactivate") {
      p.state.active = false;
      p.state.alarms = emptyAlarms();
    } else if (action === "resetExposure") {
      p.state.exposure = emptyExposure(r.env.simTime);
      p.state.alarms = emptyAlarms();
    } else if (action === "ack") {
      p.state.alarms = evaluate(
        r.env.values,
        r.env.faults,
        r.env.battery,
        r.env.profile,
        exposures(p.state.exposure, r.env.simTime, r.env.profile.stelMinutes),
        p.state.alarms,
        true,
      );
    }
    await this.evaluate(r);
    await this.event(
      r,
      action.toUpperCase(),
      { visible, exposureBeforeReset },
      p.id,
    );
    await this.save(r);
    this.broadcast(r);
  }
  async connection(r: Room, p: Person, id: string, connected: boolean) {
    if (connected) p.sockets.add(id);
    else p.sockets.delete(id);
    if (!p.sockets.size) p.state.foreground = false;
    await this.event(r, connected ? "CONNECTED" : "DISCONNECTED", {}, p.id);
    await this.save(r);
    this.broadcast(r);
  }
}
