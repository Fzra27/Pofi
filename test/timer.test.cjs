const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Timer } = require("../timer.cjs");
test("selected minutes, pause, walking consent, decay, return alert and restore", () => {
  let now = 1700000000000;
  const t = new Timer({ now: () => now }),
    alerts = [];
  t.on("alert", (e) => alerts.push(e.type));
  t.command("settings", { focusMinutes: 2, breakMinutes: 1 });
  t.command("toggle");
  now += 30000;
  assert.equal(t.snapshot().remaining, 90);
  t.command("toggle");
  now += 60000;
  assert.equal(t.snapshot().remaining, 90);
  t.command("toggle");
  now += 90000;
  assert.equal(t.snapshot().mode, "ready");
  assert.equal(t.state.completed, 1);
  assert.equal(t.state.focusTotal, 2);
  assert.deepEqual(alerts, ["walk"]);
  now += 61000;
  assert(now - t.state.overdueAt > 60000);
  t.command("toggle");
  assert.equal(t.state.mode, "break");
  assert.equal(t.state.remaining, 60);
  assert.equal(t.state.overdueAt, null);
  const restored = new Timer({ now: () => now, saved: t.state });
  now += 60000;
  assert.equal(restored.snapshot().mode, "focus");
  assert.equal(restored.state.remaining, 120);
  assert.equal(restored.state.lastEvent.type, "return");
  assert(!restored.state.running);
});
test("reject invalid settings and protect an active timer", () => {
  const t = new Timer();
  for (const value of [
    { focusMinutes: 0, breakMinutes: 5 },
    { focusMinutes: 121, breakMinutes: 5 },
    { focusMinutes: 45, breakMinutes: 31 },
    { focusMinutes: 1.5, breakMinutes: 5 },
  ])
    assert.throws(() => t.command("settings", value));
  t.command("toggle");
  assert.throws(() =>
    t.command("settings", { focusMinutes: 25, breakMinutes: 5 }),
  );
  t.command("reset");
  assert.equal(t.state.remaining, 2700);
});
test("daily statistics roll over while preferences persist", () => {
  let now = new Date("2026-11-09T12:00:00").getTime();
  const t = new Timer({ now: () => now });
  t.state.completed = 3;
  t.state.focusTotal = 135;
  now += 86400000;
  assert.equal(t.snapshot().completed, 0);
  assert.equal(t.state.focusMinutes, 45);
});
