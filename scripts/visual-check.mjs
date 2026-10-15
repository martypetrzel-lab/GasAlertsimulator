import "dotenv/config";
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { io } from "socket.io-client";
const saved = readFileSync(".local/PRISTUP.txt", "utf8");
const email = saved.match(/E-mail: (.+)/)[1].trim(),
  password = saved.match(/Heslo: (.+)/)[1].trim();
const browser = await chromium.launch(),
  ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
  page = await ctx.newPage();
const base = process.env.APP_ORIGIN || "http://localhost:3000";
mkdirSync(".local/nahledy", { recursive: true });
await page.goto(base);
await page.screenshot({ path: ".local/nahledy/uvod.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: ".local/nahledy/uvod-mobil.png",
  fullPage: true,
});
await page.setViewportSize({ width: 1440, height: 1000 });
const login = await ctx.request.post(`${base}/api/login`, {
  data: { email, password },
});
if (!login.ok()) throw new Error("Přihlášení vizuální kontroly selhalo.");
const exercise = await (
  await ctx.request.post(`${base}/api/exercises`, {
    data: { name: "Odborná příprava · kotelna" },
  })
).json();
const cookie = (await ctx.cookies())
  .map((c) => `${c.name}=${c.value}`)
  .join("; ");
const socket = io(base, {
  auth: { role: "instructor" },
  transports: ["websocket"],
  extraHeaders: { Cookie: cookie },
});
await new Promise((resolve, reject) => {
  socket.once("connect", resolve);
  socket.once("connect_error", reject);
});
const command = (command) =>
  new Promise((resolve, reject) =>
    socket.emit("instructor:command", { id: exercise.id, command }, (r) =>
      r.error ? reject(new Error(r.error)) : resolve(r),
    ),
  );
try {
  await page.goto(`${base}/instruktor`);
  await page
    .getByRole("button")
    .filter({ hasText: "Odborná příprava · kotelna" })
    .click();
  await page.locator(".gas-CO").waitFor();
  await page.screenshot({
    path: ".local/nahledy/instruktor.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/nahledy/instruktor-mobil.png",
    fullPage: true,
  });
  const joined = await (
    await ctx.request.post(`${base}/api/join`, {
      data: { code: exercise.code, label: "Hasič 1" },
    })
  ).json();
  const fireCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    fire = await fireCtx.newPage();
  await fire.goto(base);
  await fire.evaluate(
    ({ code, token }) =>
      localStorage.setItem(`gasalert-detector-${code}`, token),
    { code: exercise.code, token: joined.token },
  );
  await fire.goto(`${base}/detektor?kod=${exercise.code}`);
  await fire
    .getByRole("button", { name: "Aktivovat detektor", exact: true })
    .click();
  await fire.getByTestId("detector-CO").waitFor();
  await fire.screenshot({
    path: ".local/nahledy/detektor.png",
    fullPage: true,
  });
  await fire.setViewportSize({ width: 320, height: 568 });
  await fire.screenshot({
    path: ".local/nahledy/detektor-maly.png",
    fullPage: true,
  });
  const fit = await fire.evaluate(() => ({
    width: innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    height: innerHeight,
    pageHeight: document.documentElement.scrollHeight,
  }));
  console.log("Rozměry detektoru na malém telefonu:", fit);
  if (fit.pageWidth > fit.width || fit.pageHeight > fit.height)
    throw new Error("Detektor přesahuje malý displej.");
  await fireCtx.close();
} finally {
  await command({ type: "end" });
  socket.disconnect();
  await ctx.request.delete(`${base}/api/exercises/${exercise.id}`);
  await browser.close();
}
console.log("Náhledy jsou v .local/nahledy/.");
