const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { startServer } = require("../server.cjs");
test("paired clients share one timer, unpaired requests are rejected, session clears on restart while preferences persist", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pofi-test-"));
  let app = await startServer({ port: 0, host: "127.0.0.1", dataDir });
  try {
    let base = app.url.split("/#")[0];
    let headers = {
      "X-Pofi-Token": app.token,
      "Content-Type": "application/json",
    };
    assert.equal((await fetch(base + "/api/state")).status, 401);
    assert.equal((await fetch(base + "/.pofi-data/state.json")).status, 404);
    const post = async (action, value) => {
      const r = await fetch(base + "/api/command", {
        method: "POST",
        headers,
        body: JSON.stringify({ action, value }),
      });
      assert.equal(r.status, 200);
      return r.json();
    };
    await post("settings", { focusMinutes: 25, breakMinutes: 7 });
    await post("toggle");
    const mobile = await (await fetch(base + "/api/state", { headers })).json();
    assert.equal(mobile.focusMinutes, 25);
    assert(mobile.running);
    await post("skip");
    await post("toggle");
    assert.equal(
      (await (await fetch(base + "/api/state", { headers })).json()).mode,
      "break",
    );
    const pair = await fetch(base + "/api/pair", { headers });
    if (
      Object.values(os.networkInterfaces())
        .flat()
        .some((i) => i.family === "IPv4" && !i.internal)
    ) {
      const info = await pair.json();
      assert(info.qr.startsWith("data:image/png;base64,"));
      assert.equal(
        new URLSearchParams(new URL(info.link).hash.slice(1)).get("token"),
        app.token,
      );
    }
    await app.close();
    app = await startServer({ port: 0, host: "127.0.0.1", dataDir });
    assert.equal(app.timer.state.mode, "focus");
    assert.equal(app.timer.state.sessions, 0);
    assert.equal(app.timer.state.walkMs, 0);
    assert.equal(app.timer.state.focusMs, 0);
    assert.deepEqual(
      Object.keys(
        JSON.parse(fs.readFileSync(path.join(dataDir, "state.json"), "utf8")),
      ).sort(),
      ["breakMinutes", "focusMinutes", "sound"],
    );
    assert.equal(app.timer.state.breakMinutes, 7);
  } finally {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
