import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT) || 5173;
const root = process.cwd();
const publicRoot = join(root, "public");
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png"
};

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname.startsWith("/src/")
    ? join(root, normalize(pathname.slice(1)))
    : join(publicRoot, normalize(pathname === "/" ? "index.html" : pathname.slice(1)));

  const allowed = requestedPath.startsWith(publicRoot) || requestedPath === join(root, "src", "pet.js");
  if (!allowed || !existsSync(requestedPath) || !statSync(requestedPath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": types[extname(requestedPath)] || "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(requestedPath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`桌宠预览已启动：http://localhost:${port}`);
});
