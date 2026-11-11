const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Timer } = require("../timer.cjs");
test("walking deadline keeps counting extra time and never starts focus until the user clicks", () => {
  let now = 0;
  const t = new Timer({ now: () => now }),
    alerts = [];
  t.on("alert", (e) => alerts.push(e.type));
  t.command("toggle");
  now = 40 * 60000;
  t.command("early-walk");
  now += 5 * 60000;
  let s = t.snapshot();
  assert.equal(s.mode, "break");
  assert(s.running && s.expired);
  assert.equal(s.overtime, 0);
  assert.equal(s.sessions, 1);
  assert.equal(s.focusMs, 40 * 60000);
  assert.deepEqual(alerts, ["return"]);
  now += 135000;
  s = t.snapshot();
  assert.equal(s.mode, "break");
  assert.equal(s.overtime, 135);
  assert.equal(s.walkMs, 435000);
  assert.equal(s.focusMs, 40 * 60000);
  assert.equal(s.sessions, 1);
  assert.equal(s.history.length, 1);
  assert.deepEqual(alerts, ["return"]);
  t.command("toggle");
  s = t.snapshot();
  assert.equal(s.mode, "focus");
  assert(s.running);
  assert.equal(s.remaining, 45 * 60);
  assert.equal(s.sessions, 2);
  assert.equal(s.history[1].durationMs, 435000);
  assert.equal(s.history[1].extraMs, 135000);
  assert(s.history[1].completed);
  assert.equal(s.walkMs, 435000);
});
test("both custom phase durations allow overtime; a late tick stays charged to walking", () => {
  let now = 0;
  const t = new Timer({ now: () => now }),
    alerts = [];
  t.on("alert", (e) => alerts.push(e.type));
  t.command("settings", { focusMinutes: 25, breakMinutes: 7 });
  t.command("toggle");
  now = 25 * 60000 + 15000;
  assert.equal(t.snapshot().overtime, 15);
  t.command("toggle");
  now += 7 * 60000 + 10000;
  let s = t.snapshot();
  assert.equal(s.mode, "break");
  assert(s.running && s.expired);
  assert.equal(s.overtime, 10);
  assert.equal(s.walkMs, 430000);
  assert.equal(s.focusMs, 1515000);
  assert.deepEqual(alerts, ["walk", "return"]);
  t.command("early-focus");
  s = t.snapshot();
  assert.equal(s.remaining, 25 * 60);
  assert.equal(s.history[1].durationMs, 430000);
  assert.equal(s.history[1].extraMs, 10000);
  assert.equal(s.history[1].endedAt, now);
});
test("paused walking time is excluded and reaching its deadline still waits for confirmation", () => {
  let now = 0;
  const t = new Timer({ now: () => now });
  assert.throws(() => t.command("early-walk"));
  t.command("toggle");
  now = 10000;
  t.command("early-walk");
  now += 120000;
  t.command("toggle");
  now += 600000;
  assert.equal(t.snapshot().remaining, 180);
  assert.equal(t.state.walkMs, 120000);
  t.command("toggle");
  now += 180000;
  let s = t.snapshot();
  assert.equal(s.mode, "break");
  assert.equal(s.overtime, 0);
  assert.equal(s.walkMs, 300000);
  assert.equal(s.sessions, 1);
  now += 15000;
  t.command("toggle");
  s = t.snapshot();
  assert.equal(s.mode, "focus");
  assert.equal(s.remaining, 2700);
  assert.equal(s.walkMs, 315000);
  assert.equal(s.sessions, 2);
});
test("a long delayed tick cannot create phantom study sessions after the walk", () => {
  let now = 0;
  const t = new Timer({ now: () => now }),
    alerts = [];
  t.on("alert", (e) => alerts.push(e.type));
  t.command("toggle");
  t.command("early-walk");
  now = 2 * 60 * 60000;
  const s = t.snapshot();
  assert.equal(s.mode, "break");
  assert.equal(s.walkMs, 7200000);
  assert.equal(s.focusMs, 0);
  assert.equal(s.sessions, 1);
  assert.equal(s.overtime, 115 * 60);
  assert.deepEqual(alerts, ["return"]);
  t.snapshot();
  assert.deepEqual(alerts, ["return"]);
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

test("returning early records only actual walking time and starts the full custom focus immediately", () => {
  let now = 0;
  const t = new Timer({ now: () => now });
  assert.throws(() => t.command("early-focus"));
  t.command("settings", { focusMinutes: 25, breakMinutes: 5 });
  t.command("toggle");
  now = 60000;
  t.command("early-walk");
  now += 120000;
  assert.equal(t.snapshot().remaining, 180);
  t.command("early-focus");
  assert.equal(t.state.mode, "focus");
  assert(t.state.running);
  assert.equal(t.state.remaining, 25 * 60);
  assert.equal(t.state.walkMs, 120000);
  assert.equal(t.state.focusMs, 60000);
  assert.equal(t.state.history[1].durationMs, 120000);
  assert.equal(t.state.history[1].completed, false);
  assert.equal(t.state.sessions, 2);
  assert.throws(() => t.command("early-focus"));
  now += 10000;
  assert.equal(t.snapshot().remaining, 25 * 60 - 10);
});
test("returning from a paused walk excludes paused time and resumes fresh focus running", () => {
  let now = 0;
  const t = new Timer({ now: () => now });
  t.command("toggle");
  now = 10000;
  t.command("early-walk");
  now += 30000;
  t.command("toggle");
  now += 90000;
  t.command("early-focus");
  assert.equal(t.state.walkMs, 30000);
  assert.equal(t.state.history[1].durationMs, 30000);
  assert.equal(t.state.remaining, 45 * 60);
  assert(t.state.running);
  assert.equal(t.state.sessions, 2);
});
