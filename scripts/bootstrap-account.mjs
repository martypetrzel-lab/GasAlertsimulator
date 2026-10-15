import { PrismaClient } from "@prisma/client";

// Volitelná první aktivace hostingu. Existující účet ani heslo se nikdy nepřepisují.
export async function bootstrapAccount() {
  const email = process.env.BOOTSTRAP_INSTRUCTOR_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.BOOTSTRAP_INSTRUCTOR_PASSWORD_HASH;
  if (!email && !passwordHash) return;
  if (
    !email?.includes("@") ||
    !passwordHash ||
    !/^([a-f0-9]{32}):([a-f0-9]{128})$/.test(passwordHash)
  )
    throw new Error("Neplatná konfigurace prvního instruktorského účtu.");
  const db = new PrismaClient();
  try {
    await db.instructor.upsert({
      where: { email },
      create: { email, passwordHash },
      update: {},
    });
    console.log("Počáteční instruktorský účet je připraven.");
  } finally {
    await db.$disconnect();
  }
}
