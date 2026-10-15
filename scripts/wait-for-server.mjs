const url = process.env.E2E_URL || "http://localhost:3000";
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const result = await fetch(`${url}/api/health`);
    if (result.ok) {
      ready = true;
      break;
    }
  } catch {
    /* Server ještě startuje. */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!ready) throw new Error("Server není dostupný do 60 sekund.");
console.log("Server a databáze jsou dostupné.");
