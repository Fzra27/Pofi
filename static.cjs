const fs = require("node:fs"),
  path = require("node:path");
function headers(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
}
function serveStatic(req, res, pathname) {
  const allowed = {
    "/": "index.html",
    "/index.html": "index.html",
    "/style.css": "style.css",
    "/app.js": "app.js",
    "/icon.png": "icon.png",
    "/manifest.webmanifest": "manifest.webmanifest",
  };
  const file = Object.hasOwn(allowed, pathname) ? allowed[pathname] : null;
  if (req.method !== "GET" || !file) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".webmanifest": "application/manifest+json",
  };
  res.setHeader("Content-Type", types[path.extname(file)]);
  fs.createReadStream(path.join(__dirname, "public", file))
    .on("error", () => {
      if (!res.headersSent) res.statusCode = 404;
      res.end();
    })
    .pipe(res);
}
module.exports = { headers, serveStatic };
