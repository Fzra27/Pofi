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
  const overdue = mode === "ready" && now - s.overdueAt > 60000;
  document.body.classList.toggle("break", mode === "break" && s.running);
  document.body.classList.toggle("overdue", overdue);
  const m = Math.floor(remaining / 60),
    sec = remaining % 60;
  $("timer").innerHTML =
    `${String(m).padStart(2, "0")}<span>:</span>${String(sec).padStart(2, "0")}`;
  $("progress").style.width =
    `${mode === "ready" ? 100 : 100 * (1 - remaining / ((mode === "break" ? s.breakMinutes : s.focusMinutes) * 60))}%`;
  $("mode-label").textContent =
    mode === "focus"
      ? "FOCUS TIME"
      : mode === "ready"
        ? "TIME TO STAND UP!"
        : "WALKING BREAK";
  $("toggle").textContent = s.running
    ? "Pause Ⅱ"
    : mode === "ready"
      ? "I’m up. Let’s walk →"
      : mode === "break"
        ? "Continue walking →"
        : remaining === s.focusMinutes * 60
          ? "Start focusing →"
          : "Continue focusing →";
  $("toggle").disabled = !connected;
  $("speech").innerHTML =
    mode === "focus"
      ? "You bring the focus. I’ll keep the time.<span>One small thing at a time.</span>"
      : mode === "ready"
        ? "We’re growing roots! Time to get up.<span>A little walk will do us good.</span>"
        : "Look at us go! Keep on walking.<span>Every little step counts.</span>";
  $("timer-note").textContent =
    mode === "focus"
      ? `${s.focusMinutes} minutes of focus. ${s.breakMinutes} minutes on your feet.`
      : mode === "ready"
        ? "Your break starts when you tap “I’m up”."
        : "Step away from the screen. Come back when the chime rings.";
  $("mascot-caption").textContent = overdue
    ? "Getting a little wilted… let’s walk!"
    : mode === "break"
      ? "A little movement brings me back to life."
      : "Happy potato. Happy you.";
  $("health").textContent = overdue ? "A little wilted" : "Feeling fresh";
  $("session").textContent = `Round ${s.completed + 1}`;
  $("completed").textContent = s.completed;
  $("minutes").innerHTML = `${s.focusTotal} <small>min</small>`;
  $("sound").innerHTML = `♪ <span>Sound ${s.sound ? "on" : "off"}</span>`;
  $("sound").setAttribute("aria-pressed", String(s.sound));
  const locked =
    mode !== "focus" || s.running || s.remaining !== s.focusMinutes * 60;
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
  document.title = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")} · Pofi`;
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
