import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
const root = resolve(".local");
mkdirSync(root, { recursive: true });
const credentials = resolve(root, "postgres.json");
const options = existsSync(credentials)
  ? JSON.parse(readFileSync(credentials, "utf8"))
  : {
      user: "gasalert",
      password: randomBytes(24).toString("hex"),
      port: 55432,
    };
if (!existsSync(credentials))
  writeFileSync(credentials, JSON.stringify(options));
const databaseDir = resolve(root, "postgres");
const pg = new EmbeddedPostgres({
  ...options,
  databaseDir,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (e) => console.error(String(e)),
});
if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("gasalert");
} catch (e) {
  if (!String(e).includes("already exists")) throw e;
}
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    `DATABASE_URL=postgresql://${options.user}:${options.password}@127.0.0.1:${options.port}/gasalert\nAPP_ORIGIN=http://localhost:3000\nPORT=3000\n`,
  );
console.log(
  "Lokální PostgreSQL je připravena na 127.0.0.1:55432. Připojení je uloženo v .env.",
);
process.on("SIGINT", () => void pg.stop().finally(() => process.exit()));
process.on("SIGTERM", () => void pg.stop().finally(() => process.exit()));
setInterval(() => {}, 60000);
