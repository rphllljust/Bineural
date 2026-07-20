import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["src", "tests", "scripts"];
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (path.endsWith("scripts/lint.mjs")) continue;
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (![".ts", ".mjs"].includes(extname(entry.name))) continue;
    const content = await readFile(path, "utf8");
    const lines = content.split(/\r?\n/u);
    lines.forEach((line, index) => {
      const checks = [
        { expression: /\bany\b/u, message: "uso explícito de any" },
        { expression: /@ts-ignore/u, message: "@ts-ignore proibido" },
        { expression: /console\.(log|debug)\(/u, message: "console.log/debug fora do logger controlado" },
        { expression: /\bsetTimeout\(/u, message: "setTimeout proibido no núcleo de áudio" }
      ];
      for (const check of checks) {
        if (check.expression.test(line)) {
          violations.push(`${relative(process.cwd(), path)}:${index + 1}: ${check.message}`);
        }
      }
    });
  }
}

for (const root of roots) await walk(root);
if (violations.length > 0) {
  process.stderr.write(`${violations.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Lint técnico concluído sem violações.\n");
}
