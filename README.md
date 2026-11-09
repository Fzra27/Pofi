# Pofi 🥔

A little focus. A little movement. An English-language focus companion for **Ubuntu desktop**, with a **QR-paired iPhone walking timer**.

## Ubuntu: install the desktop app

Download `pofi_1.1.0_amd64.deb` (64-bit Intel/AMD Ubuntu 22.04 or newer) and install:

```sh
sudo apt install ./pofi_1.1.0_amd64.deb
```

Open **Pofi** from Applications. It includes its runtime: no Node.js installation is needed for the `.deb`. Focus and break completion use Ubuntu's native notification service and an audible chime. Allow Pofi notifications and sound in Ubuntu Settings; Do Not Disturb may suppress banners. Closing the window or choosing **Quit Pofi** ends the app and clears session statistics. Minimize the window to keep the session running. The computer must remain awake. Phone pairing uses port **4317**.

## Choose your minutes

Drag the Focus slider (1–120 minutes) and Walk slider (1–30 minutes). Presets: 25, 45, 60 minutes. Default: 45 / 5. Durations are locked during a session; reset before changing them. Space starts/pauses. The round-completion count measures completed focus periods. Skipping does not count as completing a focus period.

When focus finishes, Pofi chimes once and keeps counting **+ overtime** in the focus phase. Click **“I’m up. Start walking”** to start the walk. When the walk finishes, Pofi chimes once and continues counting extra walking time until you click **“I’m back. Start focusing”**. No phase switches automatically and no window is raised automatically. Notifications only raise the window if you click them. Ignoring the focus reminder for a minute makes Pofi wilt; starting the walk revives the potato.

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
sudo apt install ./dist/pofi_1.1.0_amd64.deb
```

## iPhone: pair with the QR code

1. Keep Ubuntu and iPhone on the **same trusted Wi-Fi**. Run Pofi on Ubuntu.
2. Click **Pair iPhone**. Choose your computer's Wi-Fi address if multiple networks are listed. Scan the QR using the iPhone camera, then open it in Safari.
3. Tap **Enable this phone’s return chime** once. Start the walk from either device. They share one authoritative timer; pausing/resetting on either device updates both.
4. Keep **Safari in the foreground and the screen awake** for the return chime. Screen wake lock is requested where available; local HTTP on iPhone may not support it. Use a suitable Auto-Lock setting during the walk.

The desktop is the host; Wi-Fi and Ubuntu must remain available. If pairing fails, check that the QR uses the Wi-Fi address, guest Wi-Fi client isolation is off, and the firewall permits TCP 4317 **from your local network only**. Do not forward this port on your router. QR codes contain a private pairing key; only share with devices you want to control the timer. Keys rotate when Pofi restarts; rescan then. Only duration and sound preferences survive app restarts. Session statistics reset on quit; reloading Safari does not reset them.

This is a Safari companion, not an App Store app. Local HTTP cannot provide reliable **locked-screen/background iOS push notifications**. Those require an HTTPS deployment, installed web app, permission and a push service, which are not part of this local desktop edition. Ubuntu continues to notify independently while its app is minimized. Pofi does not measure actual steps or movement.

## Develop / build

Node.js **24+**, npm, Linux x64 for the desktop build:

```sh
npm ci
npm test
npm run desktop
npm run build:linux
```

`postinstall` downloads the pinned official Electron binary with checksum verification. Behind a proxy, Node 24 can use inherited proxy settings with `NODE_USE_ENV_PROXY=1 npm ci`; keep your normal CA trust settings. `npm run build:linux` creates `dist/pofi_1.1.0_amd64.deb` without publishing. For web-only development, `npm start` prints a private local pairing URL. Use that URL, not a static file server; the Node process owns the synchronized timer. `PORT` and `POFI_DATA_DIR` are optional server overrides. Desktop state lives in Electron's per-user application data directory.

## Validation

`npm test` covers overtime in both phases, manual transitions, exactly-once alerts, accurate paused-time accounting, session counts/logs, preferences-only persistence, paired-device access, update version ordering and update failures that prevent privileged installation. Desktop and phone browser flows are checked with Chromium emulation; native notifications were exercised over a test D-Bus service. A real physical iPhone and the user's Ubuntu password dialog still require device-side confirmation. The local HTTP iOS foreground limitation remains unchanged.
