const { EventEmitter } = require("node:events");
class Timer extends EventEmitter {
  constructor({ now = Date.now, saved = {} } = {}) {
    super();
    this.now = now;
    this.state = {
      focusMinutes: 45,
      breakMinutes: 5,
      mode: "focus",
      remaining: 2700,
      running: false,
      deadline: null,
      overdueAt: null,
      completed: 0,
      focusTotal: 0,
      date: this.day(),
      sound: true,
      eventId: 0,
      lastEvent: null,
      ...saved,
    };
    this.rollDay();
  }
  day() {
    return new Date(this.now()).toLocaleDateString("en-CA");
  }
  rollDay() {
    if (this.state.date !== this.day()) {
      this.state.date = this.day();
      this.state.completed = 0;
      this.state.focusTotal = 0;
    }
  }
  snapshot() {
    this.tick();
    return { ...this.state, serverNow: this.now() };
  }
  announce(type) {
    const s = this.state;
    s.eventId++;
    s.lastEvent = { id: s.eventId, type, at: this.now() };
    this.emit("alert", s.lastEvent);
  }
  tick() {
    const s = this.state;
    this.rollDay();
    if (s.running) {
      s.remaining = Math.max(0, Math.ceil((s.deadline - this.now()) / 1000));
      if (s.remaining === 0) {
        s.running = false;
        s.deadline = null;
        if (s.mode === "focus") {
          s.completed++;
          s.focusTotal += s.focusMinutes;
          s.mode = "ready";
          s.overdueAt = this.now();
          this.announce("walk");
        } else {
          s.mode = "focus";
          s.remaining = s.focusMinutes * 60;
          s.overdueAt = null;
          this.announce("return");
        }
        this.emit("change");
      }
    }
  }
  command(action, value) {
    this.tick();
    const s = this.state;
    switch (action) {
      case "toggle":
        if (s.running) {
          s.running = false;
          s.deadline = null;
        } else {
          if (s.mode === "ready") {
            s.mode = "break";
            s.remaining = s.breakMinutes * 60;
            s.overdueAt = null;
          }
          s.running = true;
          s.deadline = this.now() + s.remaining * 1000;
        }
        break;
      case "reset":
        s.mode = "focus";
        s.running = false;
        s.deadline = null;
        s.remaining = s.focusMinutes * 60;
        s.overdueAt = null;
        break;
      case "skip":
        s.running = false;
        s.deadline = null;
        if (s.mode === "focus") {
          s.mode = "ready";
          s.remaining = 0;
          s.overdueAt = this.now();
        } else {
          s.mode = "focus";
          s.remaining = s.focusMinutes * 60;
          s.overdueAt = null;
        }
        break;
      case "settings":
        if (
          s.running ||
          s.mode !== "focus" ||
          s.remaining !== s.focusMinutes * 60
        )
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
        s.remaining = s.focusMinutes * 60;
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
