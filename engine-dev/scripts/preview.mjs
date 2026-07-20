import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = normalize(join(process.cwd(), "dist"));
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const candidate = normalize(join(root, pathname === "/" ? "index.html" : pathname));
  if (!candidate.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const stats = statSync(candidate);
    if (!stats.isFile()) throw new Error("not-file");
    response.writeHead(200, { "content-type": mimeTypes.get(extname(candidate)) ?? "application/octet-stream" });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(4173, "127.0.0.1", () => {
  process.stdout.write("Preview disponível em http://127.0.0.1:4173\n");
});
