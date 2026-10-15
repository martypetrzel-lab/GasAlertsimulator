import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { parse } from "cookie";
import { db } from "./db";
const scrypt = promisify(scryptCb);
export const token = () => randomBytes(32).toString("hex");
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return (
    salt + ":" + ((await scrypt(password, salt, 64)) as Buffer).toString("hex")
  );
}
export async function passwordValid(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  const result = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  return expected.length === result.length && timingSafeEqual(result, expected);
}
export async function session(cookie?: string) {
  const value = parse(cookie || "").gasalert_session;
  if (!value) return null;
  const found = await db.session.findUnique({
    where: { tokenHash: hash(value) },
    include: { instructor: true },
  });
  return found && found.expiresAt > new Date() ? found : null;
}
