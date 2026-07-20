import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
const result = spawnSync("tsc", ["-p", "tsconfig.build.json"], { stdio: "inherit", shell: true });
if (result.status !== 0) process.exit(result.status ?? 1);
await Promise.all([
  cp("index.html", "dist/index.html"),
  cp("styles.css", "dist/styles.css"),
  cp("manifest.webmanifest", "dist/manifest.webmanifest"),
  cp("sw.js", "dist/sw.js")
]);
process.stdout.write("Build concluído em engine-dev/dist.\n");
