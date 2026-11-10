// Dev helper: node tsx --env-file=../.env scripts/run-tool.mts <toolName> '<json args>'
import { executeTool } from "../src/tools/index.js";
import { prisma } from "../src/db.js";

const [name, args = "{}"] = process.argv.slice(2);
const out = await executeTool(name, args);
console.log(JSON.stringify(out.ok ? out.result : out, null, 2));
await prisma.$disconnect();
