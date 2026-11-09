const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Timer } = require("../timer.cjs");
test("both phases keep counting overtime until explicit transition; totals and log include it", () => {
  let now = 0;
  const t = new Timer({ now: () => now });
  const alerts = [];
  t.on("alert", (e) => alerts.push(e.type));
  t.command("settings", { focusMinutes: 1, breakMinutes: 1 });
  t.command("toggle");
  now = 75000;
  let s = t.snapshot();
  assert.equal(s.mode, "focus");
  assert(s.running && s.expired);
  assert.equal(s.overtime, 15);
  assert.equal(s.focusMs, 75000);
  assert.equal(s.completed, 1);
  assert.equal(s.sessions, 1);
  now = 80000;
  t.tick();
  assert.deepEqual(alerts, ["walk"]);
  t.command("toggle");
  assert.equal(t.state.mode, "break");
  assert.equal(t.state.history[0].durationMs, 80000);
  assert.equal(t.state.history[0].extraMs, 20000);
  now = 170000;
  s = t.snapshot();
  assert.equal(s.mode, "break");
  assert.equal(s.overtime, 30);
  assert.equal(s.walkMs, 90000);
  assert.deepEqual(alerts, ["walk", "return"]);
  t.command("toggle");
  assert.equal(t.state.mode, "focus");
  assert.equal(t.state.sessions, 2);
  assert.equal(t.state.history[1].extraMs, 30000);
});
test("pause excludes time, resuming does not add a session, reset retains session totals", () => {
  let now = 0;
  const t = new Timer({ now: () => now });
  t.command("toggle");
  now = 10000;
  t.command("toggle");
  now = 70000;
  assert.equal(t.snapshot().focusMs, 10000);
  t.command("toggle");
  now = 80000;
  assert.equal(t.snapshot().focusMs, 20000);
  assert.equal(t.state.sessions, 1);
  t.command("reset");
  assert.equal(t.state.focusMs, 20000);
  assert.equal(t.state.history[0].completed, false);
  assert.equal(t.state.remaining, 2700);
});
test("session survives midnight but is cleared on a new process; only preferences persist", () => {
  let now = new Date("2026-11-09T23:59:50").getTime();
  const t = new Timer({ now: () => now });
  t.command("settings", { focusMinutes: 25, breakMinutes: 7 });
  t.command("toggle");
  now += 20000;
  t.tick();
  assert.equal(t.state.focusMs, 20000);
  const fresh = new Timer({
    now: () => now,
    saved: { ...t.state, ...t.preferences() },
  });
  assert.equal(fresh.state.sessions, 0);
  assert.equal(fresh.state.focusMs, 0);
  assert.equal(fresh.state.walkMs, 0);
  assert.equal(fresh.state.history.length, 0);
  assert(!fresh.state.running);
  assert.equal(fresh.state.focusMinutes, 25);
  assert.deepEqual(Object.keys(t.preferences()).sort(), [
    "breakMinutes",
    "focusMinutes",
    "sound",
  ]);
});
test("invalid duration settings and changes during active phases are rejected", () => {
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
});
