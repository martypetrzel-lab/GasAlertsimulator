import { test, expect, request as playwrightRequest } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { db } from "../server/db";
import { passwordHash } from "../server/auth";
import { io, Socket } from "socket.io-client";
import type { DetectorSnapshot } from "../src/lib/domain";
const base = process.env.E2E_URL || "http://localhost:3000";
const email = `e2e-${randomBytes(8).toString("hex")}@example.test`,
  password = randomBytes(20).toString("hex");
let ownerId = "";
test.beforeAll(async () => {
  ownerId = (
    await db.instructor.create({
      data: { email, passwordHash: await passwordHash(password) },
    })
  ).id;
});
test.afterAll(async () => {
  const ids = (
    await db.exercise.findMany({ where: { ownerId }, select: { id: true } })
  ).map((e) => e.id);
  const api = await playwrightRequest.newContext({ baseURL: base });
  await api.post("/api/login", { data: { email, password } });
  const cookie = (await api.storageState()).cookies
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const socket = io(base, {
    auth: { role: "instructor" },
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie },
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  for (const id of ids) {
    const row = await db.exercise.findUnique({ where: { id } });
    if (row?.status !== "ended")
      await new Promise((resolve) =>
        socket.emit(
          "instructor:command",
          { id, command: { type: "end" } },
          resolve,
        ),
      );
    await api.delete(`/api/exercises/${id}`);
  }
  socket.disconnect();
  await api.dispose();
  await db.instructor.delete({ where: { id: ownerId } });
  await db.$disconnect();
});
test("instruktor, dva detektory, alarmy, reconnect, reset a historie", async ({
  browser,
}) => {
  test.setTimeout(100000);
  const instructor = await browser.newContext(),
    fire1 = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    fire2 = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await instructor.newPage(),
    a = await fire1.newPage(),
    b = await fire2.newPage();
  await page.goto("/instruktor");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Heslo", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await page.getByRole("button", { name: "Nové cvičení", exact: true }).click();
  await page
    .getByLabel("Název cvičení", { exact: true })
    .fill("Výcvik dvou hasičů");
  await page
    .getByRole("button", { name: "Vytvořit cvičení", exact: true })
    .click();
  const code = await page.locator(".code-mini").innerText();
  for (const [p, label] of [
    [a, "Hasič 1"],
    [b, "Hasič 2"],
  ] as const) {
    await p.goto(`/detektor?kod=${code}`);
    await p.getByLabel("Vaše označení", { exact: false }).fill(label);
    await p
      .getByRole("button", { name: "Připojit detektor", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Aktivovat detektor", exact: true })
      .click();
    await expect(p.getByTestId("detector-CO")).toHaveText("0");
  }
  await expect(page.locator(".participant")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Zahájit cvičení", exact: true })
    .click();
  const co = page.locator(".gas-CO");
  await co.getByLabel("CO cílová hodnota", { exact: true }).fill("150");
  await co.getByLabel("CO doba změny", { exact: true }).fill("60");
  await co.getByRole("button", { name: "Nastavit", exact: true }).click();
  // Server pokračuje po odchodu instruktora z panelu. Test běží ve skutečném čase 1:1.
  await page.goto("/");
  await expect(a.locator(".lcd-status")).toHaveText("LOW", { timeout: 20000 });
  await expect(b.locator(".lcd-status")).toHaveText("LOW");
  await expect(a.getByTestId("detector-CO")).toHaveText("150", {
    timeout: 65000,
  });
  await expect(b.getByTestId("detector-CO")).toHaveText("150");
  await page.goto("/instruktor");
  await page
    .getByRole("button")
    .filter({ hasText: "Výcvik dvou hasičů" })
    .click();
  await a.getByRole("button", { name: "Tlačítko C", exact: true }).click();
  await expect(a.locator(".lcd-top")).toContainText("♪̸");
  await co.getByLabel("CO cílová hodnota", { exact: true }).fill("250");
  await co.getByLabel("CO doba změny", { exact: true }).fill("0");
  await co.getByRole("button", { name: "Nastavit", exact: true }).click();
  await expect(a.locator(".device-body")).toHaveClass(/cadence-fast/);
  await expect(b.locator(".device-body")).toHaveClass(/cadence-fast/);
  await fire1.setOffline(true);
  await expect(a.locator(".lcd-connection")).toContainText("PORUCHA SPOJENÍ", {
    timeout: 15000,
  });
  await expect(a.getByTestId("detector-CO")).toHaveCount(0);
  await fire1.setOffline(false);
  await expect(a.getByTestId("detector-CO")).toHaveText("250", {
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: "Reset koncentrací", exact: true })
    .click();
  await expect(a.getByTestId("detector-CO")).toHaveText("0");
  await expect(a.locator(".device-body")).toHaveClass(/alarming/);
  await a.getByRole("button", { name: "Tlačítko C", exact: true }).click();
  await expect(a.locator(".device-body")).not.toHaveClass(/alarming/);
  await expect(b.locator(".device-body")).toHaveClass(/alarming/);
  await page.getByRole("button", { name: "Ukončit", exact: true }).click();
  await page
    .getByRole("button", { name: "Ukončit cvičení", exact: true })
    .click();
  await expect(a.locator(".lcd-connection")).toContainText("CVIČENÍ UKONČENO");
  await expect(b.locator(".lcd-connection")).toContainText("CVIČENÍ UKONČENO");
  await page
    .getByRole("button", { name: "Zobrazit historii", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Časová osa událostí" }),
  ).toBeVisible();
  await expect(page.locator(".timeline")).toContainText("Potvrzení alarmu");
  const rows = await db.participant.findMany({ where: { exercise: { code } } });
  expect(rows).toHaveLength(2);
  for (const row of rows)
    expect(
      (row.state as { exposure: { max: { CO: number } } }).exposure.max.CO,
    ).toBeGreaterThanOrEqual(250);
  await Promise.all([instructor.close(), fire1.close(), fire2.close()]);
});
test("server chrání API a příkazy před hasičem i cizím instruktorem", async ({
  request,
}) => {
  expect((await request.get("/api/exercises")).status()).toBe(401);
  await request.post("/api/login", { data: { email, password } });
  const created = await (
    await request.post("/api/exercises", {
      data: { name: "Kontrola oprávnění" },
    })
  ).json();
  const joined = await (
    await request.post("/api/join", {
      data: { code: created.code, label: "Omezený detektor" },
    })
  ).json();
  const detector: Socket = io(base, {
    auth: { role: "detector", token: joined.token },
    transports: ["websocket"],
  });
  await new Promise<void>((resolve, reject) => {
    detector.once("connect", () => resolve());
    detector.once("connect_error", reject);
  });
  const state = await new Promise<DetectorSnapshot>((resolve) =>
    detector.once("detector:state", resolve),
  );
  expect(state).not.toHaveProperty("ramps");
  expect(state).not.toHaveProperty("profile");
  expect(state).not.toHaveProperty("name");
  const reply = await new Promise<{ error: string }>((resolve) =>
    detector.emit(
      "instructor:command",
      {
        id: created.id,
        command: { type: "target", gas: "CO", target: 500, duration: 0 },
      },
      resolve,
    ),
  );
  expect(reply.error).toBeTruthy();
  const noWatch = await new Promise<{ error: string }>((resolve) =>
    detector.emit("instructor:watch", created.id, resolve),
  );
  expect(noWatch.error).toBeTruthy();
  detector.disconnect();
  const invalid = io(base, {
    auth: { role: "instructor" },
    transports: ["websocket"],
    reconnection: false,
  });
  await expect(
    new Promise((resolve, reject) => {
      invalid.once("connect", () => resolve(true));
      invalid.once("connect_error", reject);
    }),
  ).rejects.toThrow();
  invalid.disconnect();
  const foreign = await db.instructor.create({
    data: {
      email: `foreign-${randomBytes(8).toString("hex")}@example.test`,
      passwordHash: await passwordHash(password),
    },
  });
  const otherApi = await playwrightRequest.newContext({ baseURL: base });
  let other: Socket | undefined;
  try {
    await otherApi.post("/api/login", {
      data: { email: foreign.email, password },
    });
    expect(
      (await otherApi.get(`/api/exercises/${created.id}/history`)).status(),
    ).toBe(404);
    const cookie = (await otherApi.storageState()).cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    other = io(base, {
      auth: { role: "instructor" },
      transports: ["websocket"],
      extraHeaders: { Cookie: cookie },
    });
    await new Promise<void>((resolve, reject) => {
      other!.once("connect", () => resolve());
      other!.once("connect_error", reject);
    });
    const forbidden = await new Promise<{ error: string }>((resolve) =>
      other!.emit(
        "instructor:command",
        { id: created.id, command: { type: "reset" } },
        resolve,
      ),
    );
    expect(forbidden.error).toBeTruthy();
    const watch = await new Promise<{ error: string }>((resolve) =>
      other!.emit("instructor:watch", created.id, resolve),
    );
    expect(watch.error).toBeTruthy();
  } finally {
    other?.disconnect();
    await otherApi.dispose();
    await db.instructor.delete({ where: { id: foreign.id } });
  }
});

test("nový cyklus vymaže vlastní expozici a archivuje předchozí maximum", async ({
  request,
}) => {
  await request.post("/api/login", { data: { email, password } });
  const created = await (
    await request.post("/api/exercises", {
      data: { name: "Archivace výcvikového cyklu" },
    })
  ).json();
  const joined = await (
    await request.post("/api/join", {
      data: { code: created.code, label: "Hasič archiv" },
    })
  ).json();
  const cookie = (await request.storageState()).cookies
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const instructor = io(base, {
      auth: { role: "instructor" },
      extraHeaders: { Cookie: cookie },
      transports: ["websocket"],
    }),
    detector = io(base, {
      auth: { role: "detector", token: joined.token },
      transports: ["websocket"],
    });
  try {
    await Promise.all(
      [instructor, detector].map(
        (s) =>
          new Promise<void>((resolve, reject) => {
            s.once("connect", () => resolve());
            s.once("connect_error", reject);
          }),
      ),
    );
    const send = (socket: Socket, event: string, payload: unknown) =>
      new Promise<void>((resolve, reject) =>
        socket
          .timeout(5000)
          .emit(event, payload, (error: Error | null, r: { error?: string }) =>
            error || r?.error ? reject(error || new Error(r.error)) : resolve(),
          ),
      );
    await send(detector, "detector:action", { action: "activate" });
    await send(instructor, "instructor:command", {
      id: created.id,
      command: { type: "target", gas: "CO", target: 250, duration: 0 },
    });
    await send(instructor, "instructor:command", {
      id: created.id,
      command: { type: "cycle" },
    });
    const participant = await db.participant.findFirstOrThrow({
      where: { exerciseId: created.id },
    });
    expect(
      (participant.state as { exposure: { max: { CO: number } } }).exposure.max
        .CO,
    ).toBe(0);
    const events = await db.event.findMany({
      where: { exerciseId: created.id, kind: "COMMAND" },
    });
    const cycle = events.find(
      (e) => (e.payload as { type?: string }).type === "cycle",
    );
    expect(
      (
        cycle!.payload as {
          exposuresBeforeReset: { exposure: { max: { CO: number } } }[];
        }
      ).exposuresBeforeReset[0].exposure.max.CO,
    ).toBe(250);
  } finally {
    instructor.disconnect();
    detector.disconnect();
  }
});
