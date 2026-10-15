import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { db } from "../server/db";
import { passwordHash } from "../server/auth";
const email = "instruktor@localhost.cz";
try {
  if (await db.instructor.findUnique({ where: { email } })) {
    console.log("Lokální účet již existuje; přístup zůstává beze změny.");
  } else {
    const password = randomBytes(18).toString("base64url");
    await db.instructor.create({
      data: { email, passwordHash: await passwordHash(password) },
    });
    mkdirSync(".local", { recursive: true });
    writeFileSync(
      ".local/PRISTUP.txt",
      `LOKÁLNÍ VÝCVIKOVÁ INSTALACE\n\nAdresa: http://localhost:3000/instruktor\nE-mail: ${email}\nHeslo: ${password}\n\nSoubor je ignorován Gitem. Uchovávejte jej soukromě. Tento účet patří pouze k místní databázi.\n`,
    );
    console.log("Náhodný lokální přístup uložen do .local/PRISTUP.txt.");
  }
} finally {
  await db.$disconnect();
}
