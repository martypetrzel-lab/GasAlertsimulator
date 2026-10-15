import "dotenv/config";
import { db } from "../server/db";
import { passwordHash } from "../server/auth";
const email = process.env.INSTRUCTOR_EMAIL?.trim().toLowerCase();
const password = process.env.INSTRUCTOR_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error(
    "Nastavte INSTRUCTOR_EMAIL a INSTRUCTOR_PASSWORD (alespoň 12 znaků).",
  );
try {
  await db.instructor.create({
    data: { email, passwordHash: await passwordHash(password) },
  });
  console.log("Instruktorský účet byl vytvořen.");
} finally {
  await db.$disconnect();
}
