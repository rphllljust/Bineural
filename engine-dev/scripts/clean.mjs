import { rm } from "node:fs/promises";

const targets = process.argv.slice(2);
const resolvedTargets = targets.length > 0 ? targets : ["dist", ".test-dist", "coverage"];
await Promise.all(resolvedTargets.map((target) => rm(target, { recursive: true, force: true })));
