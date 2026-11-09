const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.hash.slice(1));
let token = params.get("token");
try {
  if (token) sessionStorage.setItem("pofi-token", token);
  else token = sessionStorage.getItem("pofi-token");
} catch {}
let storedPhone = false;
try {
  storedPhone = sessionStorage.getItem("pofi-phone") === "1";
} catch {}
const phone = params.get("phone") === "1" || storedPhone;
if (phone) {
  document.body.classList.add("phone-view");
  try {
    sessionStorage.setItem("pofi-phone", "1");
  } catch {}
}
if (location.hash) history.replaceState(null, "", location.pathname);
let state = null,
  observedAt = 0,
  lastEvent = null,
  connected = false,
  busy = false,
  audio,
  wakeLock;
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("visible");
  setTimeout(() => $("toast").classList.remove("visible"), 5000);
}
function unlockAudio() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {}
}
function chime() {
  if (!state?.sound) return;
  unlockAudio();
  try {
    [523, 659, 784, 659].forEach((hz, i) => {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        t = audio.currentTime + i * 0.24;
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch {}
}
async function keepAwake() {
  try {
    if ("wakeLock" in navigator && document.visibilityState === "visible")
      wakeLock = await navigator.wakeLock.request("screen");
  } catch {}
}
function alertEvent(event) {
  if (!event || event.id === lastEvent) return;
  lastEvent = event.id;
  const walk = event.type === "walk";
  chime();
  toast(
    walk
      ? "Time to stand up and walk!"
      : "Your walk is done. Come back refreshed!",
  );
  if (
    !window.pofiDesktop &&
    "Notification" in window &&
    Notification.permission === "granted"
  )
    try {
      new Notification(
        walk ? "Pofi — Time to walk!" : "Pofi — Time to come back!",
        {
          body: walk
            ? "Stand up and start your walking break."
            : "Your walking break is finished.",
        },
      );
    } catch {}
}
if (window.pofiDesktop) window.pofiDesktop.onAlert(alertEvent);
async function api(route, body) {
  const response = await fetch(route, {
    method: body ? "POST" : "GET",
    headers: {
      "X-Pofi-Token": token || "",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to connect.");
  return result;
}
function receive(next) {
  if (lastEvent === null) lastEvent = next.eventId;
  else alertEvent(next.lastEvent);
  state = next;
  observedAt = performance.now();
  connected = true;
  $("connection").textContent = "";
  render();
}
async function sync() {
  try {
    receive(await api("/api/state"));
  } catch (e) {
    connected = false;
    $("connection").textContent = token
      ? "Connection lost. Keep Ubuntu awake and reconnect to the same Wi-Fi."
      : e.message;
    render();
  }
}
async function command(action, value) {
  if (busy) return;
  busy = true;
  unlockAudio();
  try {
    receive(await api("/api/command", { action, value }));
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
}
function render() {
  if (!state) {
    $("toggle").disabled = true;
    return;
  }
  const s = state,
    elapsed = (performance.now() - observedAt) / 1000,
    remaining = s.running
      ? Math.max(0, s.remaining - Math.floor(elapsed))
      : s.remaining,
    mode = s.mode;
  const now = s.serverNow + elapsed * 1000;
  const expired = s.expired;
  const extra = s.overtime + (s.running && expired ? Math.floor(elapsed) : 0);
  const displaySeconds = expired ? extra : remaining;
  const overdue = mode === "focus" && expired && extra >= 60;
  document.body.classList.toggle("break", mode === "break" && s.running);
  document.body.classList.toggle("overdue", overdue);
  const m = Math.floor(displaySeconds / 60),
    sec = displaySeconds % 60;
  $("timer").innerHTML =
    `${expired ? "+" : ""}${String(m).padStart(2, "0")}<span>:</span>${String(sec).padStart(2, "0")}`;
  $("progress").style.width =
    `${expired ? 100 : 100 * (1 - remaining / ((mode === "break" ? s.breakMinutes : s.focusMinutes) * 60))}%`;
  $("mode-label").textContent = expired
    ? mode === "focus"
      ? "EXTRA FOCUS TIME"
      : "EXTRA WALKING TIME"
    : mode === "focus"
      ? "FOCUS TIME"
      : "WALKING BREAK";
  $("toggle").textContent = expired
    ? mode === "focus"
      ? "I’m up. Start walking →"
      : "I’m back. Start focusing →"
    : s.running
      ? "Pause Ⅱ"
      : mode === "break"
        ? "Start walking →"
        : s.phaseStarted
          ? "Continue focusing →"
          : "Start focusing →";
  $("toggle").disabled = !connected;
  $("speech").innerHTML = expired
    ? mode === "focus"
      ? "Still working? Every extra minute counts.<span>Start your walk whenever you’re ready.</span>"
      : "Enjoying your walk? Take your time.<span>Come back when you’re ready.</span>"
    : mode === "focus"
      ? "You bring the focus. I’ll keep the time.<span>One small thing at a time.</span>"
      : "Look at us go! Keep on walking.<span>Every little step counts.</span>";
  $("timer-note").textContent = expired
    ? "Overtime counts toward your session total. You choose when to switch."
    : mode === "focus"
      ? `${s.focusMinutes} minutes of focus. ${s.breakMinutes} minutes on your feet.`
      : "Keep walking. The chime is a reminder, not an automatic switch.";
  $("mascot-caption").textContent = overdue
    ? "Getting a little wilted… let’s walk!"
    : mode === "break"
      ? "A little movement brings me back to life."
      : "Happy potato. Happy you.";
  $("health").textContent = overdue ? "A little wilted" : "Feeling fresh";
  $("session").textContent = `Focus session ${s.sessions || 1}`;
  $("completed").textContent = s.sessions;
  const liveMs = s.running ? Math.floor(elapsed * 1000) : 0;
  const duration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
  };
  $("minutes").textContent = duration(
    s.focusMs + (s.mode === "focus" ? liveMs : 0),
  );
  $("walk-total").textContent = duration(
    s.walkMs + (s.mode === "break" ? liveMs : 0),
  );
  const historyKey = JSON.stringify(s.history);
  if ($("session-history").dataset.history !== historyKey) {
    $("session-history").dataset.history = historyKey;
    $("session-history").replaceChildren(
      ...s.history.map((entry, index) => {
        const li = document.createElement("li");
        li.textContent = `${index + 1}. ${entry.mode === "focus" ? "Focus" : "Walk"} · ${duration(entry.durationMs)}${entry.extraMs ? ` (+${duration(entry.extraMs)} extra)` : ""}${entry.completed ? "" : " · ended early"}`;
        return li;
      }),
    );
  }

  $("sound").innerHTML = `♪ <span>Sound ${s.sound ? "on" : "off"}</span>`;
  $("sound").setAttribute("aria-pressed", String(s.sound));
  const locked = s.phaseStarted || s.running;
  for (const name of ["focus", "break"]) {
    const input = $(name + "-duration");
    if (document.activeElement !== input) input.value = s[name + "Minutes"];
    input.disabled = locked || !connected;
    $(name + "-value").textContent = `${input.value} min`;
    $(name + "-plan").textContent =
      `${s[name + "Minutes"]} min ${name === "focus" ? "deep focus" : "walking break"}`;
  }
  $("settings-hint").textContent = locked
    ? "Reset the timer to change your minutes."
    : "Choose your minutes before you start.";
  document.querySelectorAll("[data-focus]").forEach((b) => {
    b.disabled = locked || !connected;
    b.classList.toggle("selected", Number(b.dataset.focus) === s.focusMinutes);
  });
  $("rhythm").textContent = `${s.focusMinutes} / ${s.breakMinutes}`;
  document.title = `${expired ? "+" : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")} · Pofi`;
}
$("enable-phone-audio").onclick = () => {
  unlockAudio();
  if (state && !state.sound) command("sound", true);
  chime();
  $("enable-phone-audio").textContent = "Return chime enabled ✓";
  keepAwake();
};
$("toggle").onclick = async () => {
  unlockAudio();
  keepAwake();
  if (
    !window.pofiDesktop &&
    "Notification" in window &&
    Notification.permission === "default"
  )
    Notification.requestPermission().catch(() => {});
  await command("toggle");
};
$("reset").onclick = () => command("reset");
$("skip").onclick = () => command("skip");
$("sound").onclick = () => {
  unlockAudio();
  command("sound", !state?.sound);
};
function settings() {
  command("settings", {
    focusMinutes: Number($("focus-duration").value),
    breakMinutes: Number($("break-duration").value),
  });
}
for (const name of ["focus", "break"]) {
  $(name + "-duration").oninput = (e) => {
    $(name + "-value").textContent = `${e.target.value} min`;
  };
  $(name + "-duration").onchange = settings;
}
document.querySelectorAll("[data-focus]").forEach(
  (b) =>
    (b.onclick = () => {
      $("focus-duration").value = b.dataset.focus;
      settings();
    }),
);
async function pair(ip) {
  $("pair-error").textContent = "";
  try {
    const info = await api(
      "/api/pair" + (ip ? "?ip=" + encodeURIComponent(ip) : ""),
    );
    $("network").replaceChildren(
      ...info.addresses.map(
        (address) =>
          new Option(
            address,
            address,
            address === info.selected,
            address === info.selected,
          ),
      ),
    );
    $("pair-qr").src = info.qr;
    $("pair-link").href = info.link;
    $("pair-link").textContent =
      info.link.split("/#")[0] + " · private pairing link";
  } catch (e) {
    $("pair-error").textContent = e.message;
  }
}
$("phone-button").onclick = () => {
  $("pair-dialog").showModal();
  pair();
};
$("close-pair").onclick = () => $("pair-dialog").close();
$("network").onchange = (e) => pair(e.target.value);
document.addEventListener("keydown", (e) => {
  if (
    e.code === "Space" &&
    !["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"].includes(
      document.activeElement.tagName,
    ) &&
    !$("pair-dialog").open
  ) {
    e.preventDefault();
    $("toggle").click();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    sync();
    keepAwake();
  }
});
$("date").textContent = new Date().toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  weekday: "long",
});
sync();
setInterval(sync, 1000);
setInterval(render, 250);

const updateButton = $("update-button");
if (window.pofiDesktop?.checkUpdate) {
  updateButton.hidden = false;
  let available = false;
  window.pofiDesktop.onUpdate((message) => {
    $("update-status").textContent = message;
  });
  updateButton.onclick = async () => {
    updateButton.disabled = true;
    try {
      if (available) {
        const result = await window.pofiDesktop.installUpdate();
        if (result.installed) {
          available = false;
          updateButton.textContent = "Installed — reopen Pofi";
        } else if (result.cancelled)
          $("update-status").textContent =
            "Update cancelled. Your timer is unchanged.";
      } else {
        const result = await window.pofiDesktop.checkUpdate();
        available = result.available;
        updateButton.textContent = available
          ? `Install Pofi ${result.version}`
          : "Check for updates";
      }
    } catch (e) {
      $("update-status").textContent = e.message;
    } finally {
      updateButton.disabled = false;
    }
  };
}
