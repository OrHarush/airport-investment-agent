import { PrismaClient } from "@prisma/client";
import { seed } from "../seed/seed.js";

/** Tests run against the seeded DB. If it is empty (fresh checkout / CI), seed it once; otherwise leave it alone. */
export default async function setup() {
  const prisma = new PrismaClient();
  try {
    const [airports, routes] = await Promise.all([prisma.airport.count(), prisma.routeStat.count()]);
    if (airports === 0 || routes === 0) {
      console.log("[test setup] DB is empty, seeding from data/clean ...");
      await seed(prisma, (s) => console.log("[seed]", s));
    }
  } finally {
    await prisma.$disconnect();
  }
}
