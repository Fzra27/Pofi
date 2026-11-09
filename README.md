# Pofi 🥔

A little focus. A little movement. An English-language focus companion for **Ubuntu desktop**, with a **QR-paired iPhone walking timer**.

## Ubuntu: install the desktop app

Download `pofi_1.3.0_amd64.deb` (64-bit Intel/AMD Ubuntu 22.04 or newer) and install:

```sh
sudo apt install ./pofi_1.3.0_amd64.deb
```

Open **Pofi** from Applications. It includes its runtime: no Node.js installation is needed for the `.deb`. Focus and break completion use Ubuntu's native notification service and an audible chime. Allow Pofi notifications and sound in Ubuntu Settings; Do Not Disturb may suppress banners. Closing the window or choosing **Quit Pofi** ends the app and clears session statistics. Minimize the window to keep the session running. The computer must remain awake. Phone pairing uses port **4317**.

## Choose your minutes

Drag the Focus slider (1–120 minutes) and Walk slider (1–30 minutes). Presets: 25, 45, 60 minutes. Default: 45 / 5. Durations are locked during a session; reset before changing them. Space starts/pauses. The round-completion count measures completed focus periods. Skipping does not count as completing a focus period.

When focus finishes, Pofi chimes once and keeps counting **+ overtime** in the focus phase. Click **“I’m up. Start walking”** to start the walk. You can also click **“Start 5-min walk early”** before the focus countdown ends: it records the actual work done and immediately starts a full walking break, without pausing or carrying the unfinished focus time into the walk. The default break is 5 minutes; a custom Walk duration still applies.

**Return early:** During a walk, click **“Start focusing early”** to record the actual walking time and immediately start a fresh full Focus period. This also works when the walk is paused; unused walking time is not counted or carried over.

When the walk finishes, Pofi chimes and **automatically starts a new full focus period using your selected Focus duration**. For example, leaving a 45-minute focus period with 5 minutes remaining starts a fresh 5-minute walk, then a fresh 45-minute focus period. Late timer ticks are split at the walking deadline so time is counted once in the correct phase. Focus overtime still requires a manual switch to walking. No window is raised automatically; notifications raise the window only if you click them. Pause remains a separate action. Ignoring the focus reminder for a minute makes Pofi wilt; starting the walk revives the potato.

## This session’s totals and log

Focus sessions count once when a new focus phase starts, not on pause/resume. Total focus and walking times include overtime and exclude pauses. The session log records each ended focus/walk phase (including early resets/skips) with its duration and extra time. The ongoing phase is included in live totals and enters the log when it ends. Reset resets the timer, not session totals. Closing/quitting Pofi clears the timer, counts, totals and log, even across midnight; only chosen durations and sound preferences are saved. Refreshing a page or minimizing Pofi keeps the host process and its session alive.

## Updates from inside Pofi (1.1+)

On Ubuntu click **Check for updates** at the bottom of the app, then **Install Pofi …**. A confirmation dialog describes the install. Pofi clones the fixed official GitHub main branch into its own temporary update directory, compares the package version, uses `npm ci` with the lockfile, runs tests, builds the `.deb`, and asks Ubuntu PolicyKit (`pkexec`) to authorize package installation. Dependencies/builds run as your user; only `dpkg --install` is elevated. Failed tests/builds prevent installation. Downloads retain normal TLS and package integrity checks. The original checkout is untouched.

This is a source-based updater: it needs Git, **Node.js 24+ and npm** (including `~/.nvm/versions/node` installations), an Internet connection and `pkexec` with a desktop authentication agent. Build tools were installed in the original terminal setup. It is not a background binary auto-updater. Errors appear in the app; cancelling the system prompt leaves the existing version installed. After success, quit and reopen Pofi; the current session then clears. Maintainers must bump `package.json` and the lockfile version for a new update to be offered.

For the first upgrade from **1.0**, which has no update button yet, quit Pofi and run:

```sh
cd "$HOME/Applications/Pofi"
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 24
git pull --ff-only
npm ci
npm test
npm run build:linux
sudo apt install ./dist/pofi_1.3.0_amd64.deb
```

## iPhone: stable pairing from any network (1.3+)

Deploy your own private relay using the repository's **Render Blueprint**:

[Deploy Pofi relay on Render](https://render.com/deploy?repo=https://github.com/Fzra27/Pofi)

1. Sign in to Render, connect this repository if prompted, and create the Blueprint. `render.yaml` defines a single free Node web service (`pofi-relay`), HTTPS and an automatically generated **POFI_RELAY_KEY**. Review the plan before creating it. No database or persistent disk is needed.
2. Wait for the service to show **Live**. Copy its public `https://…onrender.com` URL. In the service's **Environment** settings reveal/copy `POFI_RELAY_KEY`. Do not paste the key in chat or GitHub.
3. Update/reopen Pofi on Ubuntu. Open **Pair iPhone → Internet pairing**. Paste the Render URL and key, then **Save connection**. Wait for **Connected**. The **Set up on Render** button opens the same deployment page.
4. Scan the new **internet** QR once with your iPhone camera. Open in Safari and tap **Enable this phone’s return chime**. The phone may use mobile data or any Wi-Fi; the desktop makes outbound HTTPS requests, so no router port forwarding is needed.
5. Keep the same Safari page or bookmark it. Pairing is stored in the site's local storage. The link/key stay stable across Pofi/relay restarts and computer IP changes, as long as the Render address and POFI_RELAY_KEY stay unchanged. Clearing Safari site data, rotating the Render key or recreating the service with a different address requires pairing again. If desktop app data is removed, re-enter the same Render URL/key to reconnect the existing phone link. Old LAN QR links do not become internet links; scan the internet QR once after enabling it.

The desktop must remain awake with Pofi running and Internet available. The relay forwards commands and current timer state; the desktop owns the timer. If disconnected, Safari shows **computer offline** and reconnects automatically when Pofi returns. Closing Pofi clears session statistics as before; the saved connection remains. One Ubuntu installation should use each private relay. The key is stored in a mode-0600 desktop config file; only its derived phone key appears in the QR. Anyone with the phone link can control this timer. The relay operator can see timer state, including the session log; use your own private service. Changing the Render key invalidates old phone links; update the key in Ubuntu and pair again.

Render's free service can sleep while unused; waking can take around a minute and connections retry. It is not an always-on availability guarantee. The phone screen must still stay awake with Safari foregrounded for reliable sound. HTTPS enables supported wake-lock/notification features, but **locked-screen iOS Web Push is not implemented**. Internet pairing does not by itself add background push notifications.

### Local Wi-Fi mode (no hosting needed)

Without Internet pairing configured, keep Ubuntu/iPhone on the same Wi-Fi, choose the computer's Wi-Fi address under **Pair iPhone**, and scan. The local key now persists across desktop restarts; the IP address can still change. **Use local Wi-Fi only** disables Internet pairing on the computer. Permit TCP 4317 only from the local network if the Ubuntu firewall requires it. Do not forward the local port on your router.

### Self-host the relay

Use Node.js 24+ and a reverse proxy providing HTTPS. Set a random `POFI_RELAY_KEY` of at least 32 characters (keep it stable), set `PORT` if needed, run `npm ci --omit=dev --ignore-scripts`, then `npm run relay`. Electron is not downloaded or required for the relay. `/healthz` is the public health check; all timer and bridge APIs require authentication. A single process serves the relay; do not load balance multiple independent copies without shared state. The relay keeps only transient state/commands in memory. Restarting it does not change the derived phone key when its configured secret stays the same.

## Develop / build

Node.js **24+**, npm, Linux x64 for the desktop build:

```sh
npm ci
npm test
npm run desktop
npm run build:linux
```

`postinstall` downloads the pinned official Electron binary with checksum verification. Behind a proxy, Node 24 can use inherited proxy settings with `NODE_USE_ENV_PROXY=1 npm ci`; keep your normal CA trust settings. `npm run build:linux` creates `dist/pofi_1.3.0_amd64.deb` without publishing. For web-only development, `npm start` prints a private local pairing URL. Use that URL, not a static file server; the Node process owns the synchronized timer. `PORT` and `POFI_DATA_DIR` are optional server overrides. Desktop state lives in Electron's per-user application data directory.

## Validation

`npm test` covers early walking before focus expires, full/default and custom walking durations, automatic focus restart, late tick accounting, focus overtime, exactly-once alerts, pauses, session counts/logs, preferences-only persistence, paired-device access, stable local/internet pairing, relay authentication, host offline/reconnect and relay/desktop restarts, update version ordering and update failures that prevent privileged installation. Desktop and phone browser flows are checked with Chromium emulation; native notifications were exercised over a test D-Bus service. A real physical iPhone and the user's Ubuntu password dialog still require device-side confirmation. The local HTTP iOS foreground limitation remains unchanged.
