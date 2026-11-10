import { prisma } from "../db.js";
import { seed } from "./seed.js";

const t0 = Date.now();
try {
  const r = await seed(prisma, console.log);
  console.log(`Seed OK (IngestionRun #${r.runId}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} catch (e) {
  console.error("SEED FAILED:", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
