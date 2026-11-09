const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto");
const QRCode = require("qrcode");
const { Timer } = require("./timer.cjs");
async function startServer({
  port = Number(process.env.PORT || 4317),
  host = "0.0.0.0",
  dataDir = process.env.POFI_DATA_DIR || path.join(__dirname, ".pofi-data"),
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  let saved;
  try {
    saved = JSON.parse(
      fs.readFileSync(path.join(dataDir, "state.json"), "utf8"),
    );
  } catch {}
  const timer = new Timer({ saved });
  const token = crypto.randomBytes(24).toString("hex");
  const persist = () => {
    const file = path.join(dataDir, "state.json");
    fs.writeFileSync(file + ".tmp", JSON.stringify(timer.state), {
      mode: 0o600,
    });
    fs.renameSync(file + ".tmp", file);
  };
  timer.on("change", persist);
  const ips = () => [
    ...new Set(
      Object.values(os.networkInterfaces())
        .flat()
        .filter((i) => i.family === "IPv4" && !i.internal)
        .map((i) => i.address),
    ),
  ];
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    const url = new URL(req.url, "http://pofi.local");
    const json = (code, obj) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    try {
      if (url.pathname.startsWith("/api/")) {
        const got = Buffer.from(req.headers["x-pofi-token"] || "");
        const expected = Buffer.from(token);
        if (
          got.length !== expected.length ||
          !crypto.timingSafeEqual(got, expected)
        )
          return json(401, {
            error: "Pair using the QR code in Pofi on your computer.",
          });
        if (req.method === "GET" && url.pathname === "/api/state")
          return json(200, timer.snapshot());
        if (req.method === "GET" && url.pathname === "/api/pair") {
          const port = server.address().port;
          const addresses = ips();
          const selected = url.searchParams.get("ip") || addresses[0];
          if (!addresses.includes(selected))
            return json(400, { error: "No matching local network address." });
          const link = `http://${selected}:${port}/#token=${token}&phone=1`;
          return json(200, {
            link,
            addresses,
            selected,
            qr: await QRCode.toDataURL(link, {
              width: 240,
              margin: 2,
              errorCorrectionLevel: "M",
            }),
          });
        }
        if (req.method === "POST" && url.pathname === "/api/command") {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 4096)
              return json(413, { error: "Request too large." });
          }
          const { action, value } = JSON.parse(body);
          try {
            return json(200, timer.command(action, value));
          } catch (e) {
            return json(400, { error: e.message });
          }
        }
        return json(404, { error: "Not found" });
      }
      if (req.method !== "GET")
        return json(405, { error: "Method not allowed" });
      const allowed = {
        "/": "index.html",
        "/index.html": "index.html",
        "/style.css": "style.css",
        "/app.js": "app.js",
        "/icon.png": "icon.png",
        "/manifest.webmanifest": "manifest.webmanifest",
      };
      const file = allowed[url.pathname];
      if (!file) return json(404, { error: "Not found" });
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
          res.statusCode = 404;
          res.end();
        })
        .pipe(res);
    } catch {
      json(400, { error: "Unable to process request." });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const interval = setInterval(() => timer.tick(), 250);
  interval.unref();
  return {
    server,
    timer,
    token,
    url: `http://127.0.0.1:${server.address().port}/#token=${token}`,
    close: () => {
      clearInterval(interval);
      persist();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
if (require.main === module)
  startServer()
    .then((app) => {
      console.log(
        `Pofi is running. Open this private local pairing URL:\n${app.url}\nKeep this terminal open. Your phone must be on the same Wi-Fi.`,
      );
      for (const sig of ["SIGINT", "SIGTERM"])
        process.on(sig, async () => {
          await app.close();
          process.exit();
        });
    })
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
module.exports = { startServer };
