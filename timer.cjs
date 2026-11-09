const { EventEmitter } = require("node:events");
class Timer extends EventEmitter {
  constructor({ now = Date.now, saved = {} } = {}) {
    super();
    this.now = now;
    this.lastTick = now();
    const focusMinutes =
      Number.isInteger(saved.focusMinutes) &&
      saved.focusMinutes >= 1 &&
      saved.focusMinutes <= 120
        ? saved.focusMinutes
        : 45;
    const breakMinutes =
      Number.isInteger(saved.breakMinutes) &&
      saved.breakMinutes >= 1 &&
      saved.breakMinutes <= 30
        ? saved.breakMinutes
        : 5;
    this.state = {
      focusMinutes,
      breakMinutes,
      sound: typeof saved.sound === "boolean" ? saved.sound : true,
      mode: "focus",
      remaining: focusMinutes * 60,
      running: false,
      expired: false,
      overtime: 0,
      phaseMs: 0,
      focusMs: 0,
      walkMs: 0,
      completed: 0,
      sessions: 0,
      phaseStarted: false,
      history: [],
      eventId: 0,
      lastEvent: null,
      overdueAt: null,
    };
  }
  preferences() {
    const { focusMinutes, breakMinutes, sound } = this.state;
    return { focusMinutes, breakMinutes, sound };
  }
  snapshot() {
    this.tick();
    return {
      ...this.state,
      history: this.state.history.map((h) => ({ ...h })),
      serverNow: this.now(),
    };
  }
  announce(type) {
    const s = this.state;
    s.eventId++;
    s.lastEvent = { id: s.eventId, type, at: this.now() };
    this.emit("alert", s.lastEvent);
  }
  tick() {
    const s = this.state,
      now = this.now();
    const delta = Math.max(0, now - this.lastTick);
    this.lastTick = now;
    if (!s.running) return;
    const walkDuration = s.breakMinutes * 60000;
    if (s.mode === "break" && s.phaseMs + delta >= walkDuration) {
      const walkDelta = walkDuration - s.phaseMs;
      const focusDelta = delta - walkDelta;
      s.walkMs += walkDelta;
      s.phaseMs = walkDuration;
      s.expired = true;
      this.finish(now - focusDelta);
      this.phase("focus", true);
      s.phaseMs = focusDelta;
      s.focusMs += focusDelta;
      s.remaining = Math.max(
        0,
        Math.ceil((s.focusMinutes * 60000 - focusDelta) / 1000),
      );
      this.announce("return");
      this.emit("change");
    } else {
      s.phaseMs += delta;
      if (s.mode === "focus") s.focusMs += delta;
      else s.walkMs += delta;
    }
    const duration =
      (s.mode === "focus" ? s.focusMinutes : s.breakMinutes) * 60000;
    s.remaining = Math.max(0, Math.ceil((duration - s.phaseMs) / 1000));
    s.overtime = Math.max(0, Math.floor((s.phaseMs - duration) / 1000));
    if (!s.expired && s.phaseMs >= duration) {
      s.expired = true;
      s.overdueAt = now - Math.max(0, s.phaseMs - duration);
      if (s.mode === "focus") s.completed++;
      this.announce("walk");
    }
  }

  finish(endedAt = this.now()) {
    const s = this.state;
    if (s.phaseStarted)
      s.history.push({
        mode: s.mode,
        durationMs: s.phaseMs,
        extraMs: Math.max(
          0,
          s.phaseMs -
            (s.mode === "focus" ? s.focusMinutes : s.breakMinutes) * 60000,
        ),
        completed: s.expired,
        endedAt,
      });
  }
  phase(mode, running = false) {
    const s = this.state;
    s.mode = mode;
    s.phaseMs = 0;
    s.phaseStarted = false;
    s.running = running;
    s.expired = false;
    s.overtime = 0;
    s.overdueAt = null;
    s.remaining = (mode === "focus" ? s.focusMinutes : s.breakMinutes) * 60;
    this.lastTick = this.now();
    if (running) {
      s.phaseStarted = true;
      if (mode === "focus") s.sessions++;
    }
  }
  command(action, value) {
    this.tick();
    const s = this.state;
    switch (action) {
      case "toggle":
        if (s.expired) {
          this.finish();
          this.phase(s.mode === "focus" ? "break" : "focus", true);
        } else {
          if (!s.phaseStarted) {
            s.phaseStarted = true;
            if (s.mode === "focus") s.sessions++;
          }
          s.running = !s.running;
          this.lastTick = this.now();
        }
        break;
      case "reset":
        this.finish();
        this.phase("focus");
        break;
      case "early-walk":
        if (s.mode !== "focus" || !s.phaseStarted)
          throw new Error("Start a focus session before taking an early walk.");
        this.finish();
        this.phase("break", true);
        break;
      case "skip":
        this.finish();
        this.phase(s.mode === "focus" ? "break" : "focus", true);
        break;
      case "settings":
        if (s.phaseStarted)
          throw new Error("Reset the timer before changing durations.");
        if (
          !value ||
          !Number.isInteger(value.focusMinutes) ||
          value.focusMinutes < 1 ||
          value.focusMinutes > 120 ||
          !Number.isInteger(value.breakMinutes) ||
          value.breakMinutes < 1 ||
          value.breakMinutes > 30
        )
          throw new Error(
            "Focus must be 1–120 minutes and break 1–30 minutes.",
          );
        s.focusMinutes = value.focusMinutes;
        s.breakMinutes = value.breakMinutes;
        this.phase("focus");
        break;
      case "sound":
        if (typeof value !== "boolean")
          throw new Error("Invalid sound setting.");
        s.sound = value;
        break;
      default:
        throw new Error("Unknown action.");
    }
    this.emit("change");
    return this.snapshot();
  }
}
module.exports = { Timer };
