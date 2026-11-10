import { Prisma, type PrismaClient } from "@prisma/client";
import { CLEAN_TABLES, readCsv, snakeToCamel } from "./csv.js";

const CHUNK = 5000;

type Coercer = (v: string) => unknown;

function coercers(model: string): Map<string, Coercer> {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
  if (!m) throw new Error(`Model ${model} not found in Prisma schema`);
  const out = new Map<string, Coercer>();
  for (const f of m.fields) {
    const nullable = !f.isRequired;
    const base: Coercer =
      f.type === "Int" ? (v) => Number.parseInt(v, 10)
      : f.type === "Float" ? (v) => Number(v)
      : f.type === "Boolean" ? (v) => v === "True"
      : (v) => v;
    out.set(f.name, (v) => {
      if (v === "") {
        if (nullable) return null;
        throw new Error(`empty value in required column ${model}.${f.name}`);
      }
      const x = base(v);
      if (typeof x === "number" && !Number.isFinite(x)) throw new Error(`non-numeric "${v}" in ${model}.${f.name}`);
      return x;
    });
  }
  return out;
}

export interface SeedResult {
  runId: number;
  counts: Record<string, { csv: number; db: number }>;
}

/** Truncate the 8 clean tables (never Conversation/Message/AirportScore/IngestionRun) and reload them from data/clean. */
export async function seed(prisma: PrismaClient, log: (s: string) => void = () => {}): Promise<SeedResult> {
  const run = await prisma.ingestionRun.create({ data: { rowCounts: {} } });
  const counts: SeedResult["counts"] = {};

  const tableSql = CLEAN_TABLES.map((t) => `"${t.model}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableSql} RESTART IDENTITY`);

  for (const t of CLEAN_TABLES) {
    const { header, rows } = readCsv(t.file);
    const conv = coercers(t.model);
    const fields = header.map(snakeToCamel);
    for (const f of fields) if (!conv.has(f)) throw new Error(`${t.file}: column ${f} has no field in model ${t.model}`);
    const delegate = (prisma as any)[t.delegate];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const data = rows.slice(i, i + CHUNK).map((r, k) => {
        if (r.length !== header.length) throw new Error(`${t.file} row ${i + k + 2}: ${r.length} cells, expected ${header.length}`);
        const o: Record<string, unknown> = {};
        for (let c = 0; c < header.length; c++) o[fields[c]] = conv.get(fields[c])!(r[c]);
        return o;
      });
      await delegate.createMany({ data });
    }
    const db: number = await delegate.count();
    counts[t.model] = { csv: rows.length, db };
    log(`${t.model.padEnd(16)} csv=${String(rows.length).padStart(7)} db=${String(db).padStart(7)} ${db === rows.length ? "OK" : "MISMATCH"}`);
  }

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), rowCounts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v.db])) },
  });

  const bad = Object.entries(counts).filter(([, v]) => v.csv !== v.db);
  if (bad.length) throw new Error(`Seed row-count mismatch: ${bad.map(([k, v]) => `${k} csv=${v.csv} db=${v.db}`).join("; ")}`);
  return { runId: run.id, counts };
}
