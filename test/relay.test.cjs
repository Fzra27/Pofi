const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { startRelay } = require("../relay.cjs");
const { startServer } = require("../server.cjs");
const { relayOrigin } = require("../remote.cjs");
const waitFor = async (predicate) => {
  const deadline = Date.now() + 10000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for relay");
    await new Promise((r) => setTimeout(r, 30));
  }
};
test("internet pairing shares commands and state without LAN access; links survive desktop and relay restarts", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pofi-relay-test-")),
    key = crypto.randomBytes(32).toString("hex");
  let clock = Date.now();
  let relay = await startRelay({
    key,
    port: 0,
    host: "127.0.0.1",
    now: () => clock,
  });
  const port = relay.server.address().port,
    origin = `http://127.0.0.1:${port}`;
  let app = await startServer({ port: 0, host: "127.0.0.1", dataDir });
  try {
    app.remote.configure({ origin, key });
    await waitFor(() => app.remote.connected);
    const link = app.remote.pairing().link,
      token = new URLSearchParams(new URL(link).hash.slice(1)).get("token");
    const headers = {
      "X-Pofi-Token": token,
      "Content-Type": "application/json",
    };
    assert(!link.includes(key));
    assert.equal((await fetch(origin + "/api/state")).status, 401);
    assert.equal(
      (
        await fetch(origin + "/bridge/sync", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      401,
    );
    assert.equal(
      fs.statSync(path.join(dataDir, "remote.json")).mode & 0o777,
      0o600,
    );
    const command = async (action, value) => {
      const res = await fetch(origin + "/api/command", {
        method: "POST",
        headers,
        body: JSON.stringify({ action, value }),
      });
      assert.equal(res.status, 200);
      return res.json();
    };
    await command("toggle");
    assert.equal(app.timer.state.sessions, 1);
    await command("early-walk");
    assert.equal(app.timer.state.mode, "break");
    await command("early-focus");
    assert.equal(app.timer.state.sessions, 2);
    await waitFor(
      async () =>
        (await (await fetch(origin + "/api/state", { headers })).json())
          .sessions === 2,
    );
    assert.equal(app.remote.results.size, 0);
    const oldInstance = app.timer.state.sessionId;
    await app.close();
    clock += 11000;
    assert.equal((await fetch(origin + "/api/state", { headers })).status, 503);
    assert.equal(
      (
        await fetch(origin + "/api/command", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "toggle" }),
        })
      ).status,
      503,
    );
    app = await startServer({ port: 0, host: "127.0.0.1", dataDir });
    await waitFor(() => app.remote.connected);
    assert.equal(app.remote.pairing().link, link);
    assert.notEqual(app.timer.state.sessionId, oldInstance);
    assert.equal(app.timer.state.sessions, 0);
    await relay.close();
    relay = await startRelay({ key, port, host: "127.0.0.1" });
    await waitFor(async () => {
      const r = await fetch(origin + "/api/state", { headers });
      return r.status === 200;
    });
    assert.equal(app.remote.pairing().link, link);
    assert.equal((await fetch(origin + "/remote.json")).status, 404);
  } finally {
    await app.close();
    await relay.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
test("relay requires a strong key and HTTPS except loopback tests", async () => {
  await assert.rejects(
    () => startRelay({ key: "weak", port: 0 }),
    /32 characters/,
  );
  assert.equal(
    relayOrigin("https://pofi.example.com/"),
    "https://pofi.example.com",
  );
  for (const bad of [
    "http://public.example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com/#key",
  ])
    assert.throws(() => relayOrigin(bad));
});
