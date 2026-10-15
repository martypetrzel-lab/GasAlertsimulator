import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import next from "next";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { serialize } from "cookie";
import { z } from "zod";
import { db, json } from "./db";
import { hash, passwordValid, session, token } from "./auth";
import { Runtime } from "./runtime";
import {
  commandSchema,
  profileSchema,
  scenarioSchema,
} from "../src/lib/validation";
import { defaultProfile, scenarios } from "../src/lib/domain";
const port = Number(process.env.PORT || 3000),
  dev = process.env.NODE_ENV !== "production";
const origin = new URL(process.env.APP_ORIGIN || `http://localhost:${port}`)
  .origin;
const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
  new URL(origin).hostname,
);
if (
  !dev &&
  (!process.env.APP_ORIGIN || (!origin.startsWith("https://") && !loopback))
)
  throw new Error("Produkce vyžaduje APP_ORIGIN s HTTPS.");
const app = express(),
  http = createServer(app),
  io = new Server(http, {
    maxHttpBufferSize: 32768,
    pingInterval: 5000,
    pingTimeout: 5000,
    allowRequest: (req, cb) =>
      cb(null, !req.headers.origin || req.headers.origin === origin),
  });
const runtime = new Runtime(io);
app.disable("x-powered-by");
app.use((req, res, nextFn) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  if (
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    req.headers.origin &&
    req.headers.origin !== origin
  ) {
    res.status(403).json({ error: "Nepovolený původ požadavku." });
    return;
  }
  nextFn();
});
app.use(express.json({ limit: "40kb" }));
const limits = new Map<string, { count: number; until: number }>();
function rate(key: string, max: number, ms = 60000) {
  const now = Date.now(),
    p = limits.get(key);
  if (!p || p.until < now) {
    limits.set(key, { count: 1, until: now + ms });
    return true;
  }
  return ++p.count <= max;
}
setInterval(() => {
  for (const [key, l] of limits) if (l.until < Date.now()) limits.delete(key);
}, 60000).unref();
// Na Railway důvěřujeme pouze jednomu reverznímu proxy hopu.
app.set("trust proxy", 1);
app.use("/api", (req, res, nextFn) => {
  if (!rate(`api:${req.ip}`, 300)) {
    res
      .status(429)
      .json({ error: "Příliš mnoho požadavků. Zkuste to za minutu." });
    return;
  }
  nextFn();
});
const instructor = async (req: Request) => {
  const s = await session(req.headers.cookie);
  if (!s)
    throw Object.assign(new Error("Přihlaste se jako instruktor."), {
      status: 401,
    });
  return s.instructor;
};
app.post("/api/login", async (req, res) => {
  if (!rate(`login:${req.ip}`, 8, 15 * 60000)) {
    res
      .status(429)
      .json({ error: "Příliš mnoho pokusů. Zkuste to za 15 minut." });
    return;
  }
  const body = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(256) })
    .parse(req.body);
  const user = await db.instructor.findUnique({
    where: { email: body.email.toLowerCase() },
  });
  // Stejná scrypt práce i pro neexistující účet.
  const valid = await passwordValid(
    body.password,
    user?.passwordHash || "00000000000000000000000000000000:" + "00".repeat(64),
  );
  if (!user || !valid) {
    res.status(401).json({ error: "Nesprávný e-mail nebo heslo." });
    return;
  }
  const secret = token();
  await db.session.create({
    data: {
      tokenHash: hash(secret),
      instructorId: user.id,
      expiresAt: new Date(Date.now() + 12 * 3600000),
    },
  });
  res.setHeader(
    "Set-Cookie",
    serialize("gasalert_session", secret, {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "strict",
      path: "/",
      maxAge: 43200,
    }),
  );
  res.json({ email: user.email });
});
app.post("/api/logout", async (req, res) => {
  const s = await session(req.headers.cookie);
  if (s) {
    await db.session.delete({ where: { tokenHash: s.tokenHash } });
    for (const client of io.sockets.sockets.values())
      if (client.data.sessionHash === s.tokenHash) client.disconnect(true);
  }
  res.setHeader(
    "Set-Cookie",
    serialize("gasalert_session", "", { path: "/", maxAge: 0 }),
  );
  res.json({ ok: true });
});
app.get("/api/me", async (req, res) => {
  const u = await instructor(req);
  res.json({ email: u.email });
});
app.get("/api/health", async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});
app.get("/api/exercises", async (req, res) => {
  const u = await instructor(req);
  res.json(
    await db.exercise.findMany({
      where: { ownerId: u.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        createdAt: true,
        endedAt: true,
      },
      take: 100,
    }),
  );
});
app.post("/api/exercises", async (req, res) => {
  const u = await instructor(req);
  const b = z
    .object({
      name: z.string().min(1).max(100),
      profileId: z.string().optional(),
      exposureMode: z.enum(["activation", "cycle"]).default("activation"),
    })
    .parse(req.body);
  let p = defaultProfile;
  if (b.profileId) {
    const row = await db.profile.findFirstOrThrow({
      where: { id: b.profileId, ownerId: u.id },
    });
    p = profileSchema.parse(row.config);
  }
  res.json(
    await runtime.serial(() => runtime.create(u.id, b.name, p, b.exposureMode)),
  );
});
app.delete("/api/exercises/:id", async (req, res) => {
  const u = await instructor(req),
    id = String(req.params.id);
  await runtime.serial(async () => {
    const row = await db.exercise.findFirst({ where: { id, ownerId: u.id } });
    if (!row)
      throw Object.assign(new Error("Cvičení nebylo nalezeno."), {
        status: 404,
      });
    if (row.status !== "ended") throw new Error("Nejprve cvičení ukončete.");
    runtime.rooms.delete(id);
    io.in(`instructor:${id}`).disconnectSockets(true);
    const people = await db.participant.findMany({
      where: { exerciseId: id },
      select: { id: true },
    });
    for (const p of people) io.in(`detector:${p.id}`).disconnectSockets(true);
    await db.exercise.delete({ where: { id } });
  });
  res.json({ ok: true });
});
app.get("/api/exercises/:id/history", async (req, res) => {
  const u = await instructor(req);
  const e = await db.exercise.findFirst({
    where: { id: String(req.params.id), ownerId: u.id },
    select: {
      id: true,
      name: true,
      code: true,
      state: true,
      createdAt: true,
      endedAt: true,
    },
  });
  if (!e) {
    res.status(404).json({ error: "Cvičení nebylo nalezeno." });
    return;
  }
  const [events, samples, participants] = await Promise.all([
    db.event.findMany({
      where: { exerciseId: e.id },
      orderBy: { createdAt: "asc" },
    }),
    db.sample.findMany({
      where: { exerciseId: e.id },
      orderBy: { createdAt: "asc" },
    }),
    db.participant.findMany({
      where: { exerciseId: e.id },
      select: { id: true, label: true, state: true },
    }),
  ]);
  res.json({ exercise: e, events, samples, participants });
});
app.post("/api/join", async (req, res) => {
  if (!rate(`join:${req.ip}`, 20)) {
    res.status(429).json({ error: "Příliš mnoho pokusů." });
    return;
  }
  const b = z
    .object({
      code: z.string().regex(/^\d{6}$/),
      label: z.string().trim().max(50).default(""),
    })
    .parse(req.body);
  res.json(await runtime.serial(() => runtime.join(b.code, b.label)));
});
app.get("/api/profiles", async (req, res) => {
  const u = await instructor(req);
  res.json({
    default: defaultProfile,
    saved: await db.profile.findMany({
      where: { ownerId: u.id },
      orderBy: { createdAt: "desc" },
    }),
  });
});
app.post("/api/profiles", async (req, res) => {
  const u = await instructor(req),
    config = profileSchema.parse(req.body);
  res.json(
    await db.profile.create({
      data: { ownerId: u.id, name: config.name, config: json(config) },
    }),
  );
});
app.get("/api/scenarios", async (req, res) => {
  const u = await instructor(req);
  res.json({
    defaults: scenarios,
    saved: await db.scenario.findMany({
      where: { ownerId: u.id },
      orderBy: { createdAt: "desc" },
    }),
  });
});
app.post("/api/scenarios", async (req, res) => {
  const u = await instructor(req),
    config = scenarioSchema.parse(req.body);
  res.json(
    await db.scenario.create({
      data: { ownerId: u.id, name: config.name, config: json(config) },
    }),
  );
});
app.get("/api/references", async (req, res) => {
  await instructor(req);
  res.json(
    await db.hygieneReference.findMany({
      orderBy: [{ substance: "asc" }, { version: "desc" }],
    }),
  );
});
app.post("/api/references", async (req, res) => {
  await instructor(req);
  const b = z
    .object({
      substance: z.enum(["CO", "H2S"]),
      version: z.string().min(1).max(100),
      pel: z.number().positive(),
      npkp: z.number().positive(),
      unit: z.literal("mg/m³"),
      source: z.url().startsWith("https://"),
      verifiedAt: z.iso.datetime(),
      note: z.string().max(2000),
    })
    .parse(req.body);
  res.json(
    await db.hygieneReference.create({
      data: { ...b, verifiedAt: new Date(b.verifiedAt) },
    }),
  );
});
io.use(async (socket, nextFn) => {
  try {
    if (socket.handshake.auth.role === "instructor") {
      const s = await session(socket.request.headers.cookie);
      if (!s) throw new Error("Přihlášení vypršelo.");
      socket.data.ownerId = s.instructorId;
      socket.data.sessionHash = s.tokenHash;
      socket.data.expiresAt = s.expiresAt.getTime();
    } else {
      const secret = z.string().length(64).parse(socket.handshake.auth.token);
      const { room, person } = await runtime.serial(() =>
        runtime.identify(secret),
      );
      socket.data.roomId = room.id;
      socket.data.personId = person.id;
    }
    nextFn();
  } catch {
    nextFn(new Error("Připojení nebylo autorizováno."));
  }
});
io.on("connection", (socket) => {
  const expiry = socket.data.expiresAt
    ? setTimeout(
        () => socket.disconnect(true),
        Math.max(0, socket.data.expiresAt - Date.now()),
      )
    : undefined;
  const reply = (ack: unknown, value: unknown) => {
    if (typeof ack === "function") ack(value);
  };
  socket.on("instructor:watch", (id: unknown, ack: unknown) => {
    void runtime
      .serial(async () => {
        const ownerId = socket.data.ownerId;
        if (!ownerId) throw new Error("Pouze instruktor.");
        const s = await db.session.findUnique({
          where: { tokenHash: socket.data.sessionHash },
        });
        if (!s || s.expiresAt < new Date())
          throw new Error("Přihlášení vypršelo.");
        const room = runtime.owned(z.string().parse(id), ownerId);
        for (const r of socket.rooms)
          if (r.startsWith("instructor:")) void socket.leave(r);
        await socket.join(`instructor:${room.id}`);
        socket.emit("instructor:state", runtime.instructor(room));
        reply(ack, { ok: true });
      })
      .catch((e) => reply(ack, { error: e.message }));
  });
  socket.on("instructor:command", (input: unknown, ack: unknown) => {
    void runtime
      .serial(async () => {
        if (!socket.data.ownerId) throw new Error("Pouze instruktor.");
        if (!rate(`cmd:${socket.id}`, 180))
          throw new Error("Příliš mnoho příkazů.");
        const s = await db.session.findUnique({
          where: { tokenHash: socket.data.sessionHash },
        });
        if (!s || s.expiresAt < new Date())
          throw new Error("Přihlášení vypršelo.");
        const b = z
          .object({ id: z.string(), command: commandSchema })
          .parse(input);
        const room = runtime.owned(b.id, socket.data.ownerId);
        await runtime.tick();
        await runtime.command(room, b.command);
        reply(ack, { ok: true });
      })
      .catch((e) =>
        reply(ack, {
          error:
            e instanceof z.ZodError ? "Neplatné parametry příkazu." : e.message,
        }),
      );
  });
  if (socket.data.personId) {
    void runtime
      .serial(async () => {
        const r = runtime.rooms.get(socket.data.roomId)!,
          p = r.people.get(socket.data.personId)!;
        await socket.join(`detector:${p.id}`);
        await runtime.connection(r, p, socket.id, true);
      })
      .catch(() => socket.disconnect(true));
  }
  socket.on("detector:action", (input: unknown, ack: unknown) => {
    void runtime
      .serial(async () => {
        if (!socket.data.personId) throw new Error("Pouze detektor.");
        if (!rate(`device:${socket.id}`, 120))
          throw new Error("Příliš mnoho požadavků.");
        const b = z
          .object({
            action: z.enum([
              "activate",
              "deactivate",
              "ack",
              "resetExposure",
              "foreground",
            ]),
            visible: z.boolean().optional(),
          })
          .parse(input);
        const r = runtime.rooms.get(socket.data.roomId)!,
          p = r.people.get(socket.data.personId)!;
        await runtime.tick();
        await runtime.action(r, p, b.action, b.visible);
        reply(ack, { ok: true });
      })
      .catch((e) => reply(ack, { error: e.message }));
  });
  socket.on("disconnect", () => {
    if (expiry) clearTimeout(expiry);
    if (socket.data.personId)
      void runtime
        .serial(async () => {
          const r = runtime.rooms.get(socket.data.roomId),
            p = r?.people.get(socket.data.personId);
          if (r && p) await runtime.connection(r, p, socket.id, false);
        })
        .catch(console.error);
  });
});
let ticking = false,
  failed = false;
const timer = setInterval(() => {
  if (ticking || failed) return;
  ticking = true;
  void runtime
    .serial(() => runtime.tick())
    .catch((error) => {
      console.error("Ukládání simulace selhalo, spojení byla ukončena.", error);
      failed = true;
      io.disconnectSockets(true);
      http.close(() => process.exit(1));
      setTimeout(() => process.exit(1), 5000).unref();
    })
    .finally(() => {
      ticking = false;
    });
}, 1000);
const web = next({ dev, hostname: "0.0.0.0", port });
await runtime.load();
await web.prepare();
app.use((req, res) => web.getRequestHandler()(req, res));
app.use(
  (
    error: Error & { status?: number },
    _req: Request,
    res: Response,
    nextError: NextFunction,
  ) => {
    void nextError;
    const status = error instanceof z.ZodError ? 400 : error.status || 400;
    res.status(status).json({
      error:
        error instanceof z.ZodError
          ? "Zkontrolujte zadané údaje."
          : error.message.includes("prisma")
            ? "Databázová operace se nezdařila."
            : error.message,
    });
  },
);
http.listen(port, "0.0.0.0", () =>
  console.log(`GasAlert: http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    void runtime
      .serial(async () => {
        for (const r of runtime.rooms.values())
          if (r.env.status === "running") {
            r.env.status = "paused";
            await runtime.event(r, "SERVER_STOP", {});
            await runtime.save(r);
          }
      })
      .finally(() => {
        io.close();
        http.close();
        void db.$disconnect().finally(() => process.exit(0));
      });
  });
