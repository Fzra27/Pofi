const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { startRelay } = require("../relay.cjs");
const { startServer } = require("../server.cjs");
const { Timer } = require("../timer.cjs");
test("phone cookie restores authenticated relay access without JS storage; wrong/missing keys stay rejected", async () => {
  const key = crypto.randomBytes(32).toString("hex"),
    relay = await startRelay({ key, port: 0, host: "127.0.0.1" });
  const origin = "http://127.0.0.1:" + relay.server.address().port;
  try {
    const sync = await fetch(origin + "/bridge/sync", {
      method: "POST",
      headers: { "X-Pofi-Host": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        instance: "cookie-test",
        state: new Timer().snapshot(),
        results: [],
      }),
    });
    const { phoneKey } = await sync.json();
    let r = await fetch(origin + "/api/state", {
      headers: {
        "X-Pofi-Token": phoneKey,
        "X-Pofi-Device": "phone",
        "X-Forwarded-Proto": "https",
      },
    });
    assert.equal(r.status, 200);
    const cookie = r.headers.get("set-cookie");
    assert(cookie.includes("HttpOnly"));
    assert(cookie.includes("SameSite=Strict"));
    assert(cookie.includes("; Secure"));
    assert(cookie.includes("Max-Age=31536000"));
    r = await fetch(origin + "/api/state", {
      headers: { Cookie: cookie.split(";")[0] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("X-Pofi-Pairing"), "phone");
    assert.equal(r.headers.get("X-Pofi-Network"), "internet");
    assert.equal((await fetch(origin + "/api/state")).status, 401);
    assert.equal(
      (
        await fetch(origin + "/api/state", {
          headers: { Cookie: "pofi_pairing=wrong" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(origin + "/bridge/sync", {
          method: "POST",
          headers: { Cookie: cookie.split(";")[0] },
          body: "{}",
        })
      ).status,
      401,
    );
  } finally {
    await relay.close();
  }
});
test("local desktop is never switched to phone mode; local phone cookie restores its mode", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pofi-cookie-")),
    app = await startServer({ port: 0, dataDir });
  try {
    const origin = app.url.split("/#")[0];
    let r = await fetch(origin + "/api/state", {
      headers: { "X-Pofi-Token": app.token, "X-Pofi-Device": "desktop" },
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("Set-Cookie"), null);
    assert.equal(r.headers.get("X-Pofi-Pairing"), null);
    r = await fetch(origin + "/api/state", {
      headers: { "X-Pofi-Token": app.token, "X-Pofi-Device": "phone" },
    });
    const cookie = r.headers.get("Set-Cookie").split(";")[0];
    r = await fetch(origin + "/api/state", { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("X-Pofi-Pairing"), "phone");
    assert.equal(r.headers.get("X-Pofi-Network"), "local");
  } finally {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
