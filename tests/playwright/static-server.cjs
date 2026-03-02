const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PW_WEB_PORT || 4173);
const HOST = "127.0.0.1";
const ROOT = process.cwd();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".map": "application/json; charset=utf-8",
};

function safeResolve(urlPathname) {
  const cleanPath = decodeURIComponent(urlPathname.split("?")[0]);
  const relativePath = cleanPath === "/" ? "/editor/index.html" : cleanPath;
  const normalized = path.normalize(relativePath).replace(/^([.][.][/\\])+/, "");
  const absolute = path.resolve(ROOT, `.${normalized}`);
  if (!absolute.startsWith(ROOT)) {
    return null;
  }
  return absolute;
}

const server = http.createServer((req, res) => {
  const filePath = safeResolve(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const resolvedPath = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    fs.readFile(resolvedPath, (readError, content) => {
      if (readError) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Cache-Control": "no-store",
      });
      res.end(content);
    });
  });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Playwright static server running at http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);