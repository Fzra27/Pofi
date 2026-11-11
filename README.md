# Pofi 🥔

A little focus. A little movement. An English-language focus companion for **Linux desktop**, with a **QR-paired iPhone walking timer**.

## Linux downloads: choose your package

[Download the latest release](https://github.com/Fzra27/Pofi/releases/latest). All supplied desktop binaries target **x86_64 / Intel-AMD 64-bit**, with their Electron runtime included. Node.js is not needed to run the app.

| Distribution                           | File                            | Install / launch                                                            |
| -------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Omarchy, Arch, EndeavourOS, Manjaro    | `pofi-1.4.1-x86_64.pkg.tar.zst` | `sudo pacman -U ./pofi-1.4.1-x86_64.pkg.tar.zst`                            |
| Debian, Ubuntu, Mint                   | `pofi_1.4.1_amd64.deb`          | `sudo apt install ./pofi_1.4.1_amd64.deb`                                   |
| Other modern glibc Linux distributions | `Pofi-1.4.1-x86_64.AppImage`    | `chmod +x ./Pofi-1.4.1-x86_64.AppImage` then `./Pofi-1.4.1-x86_64.AppImage` |

### Omarchy / Arch: install from the terminal

```sh
curl -fLO https://github.com/Fzra27/Pofi/releases/download/v1.4.1/pofi-1.4.1-x86_64.pkg.tar.zst
sudo pacman -U ./pofi-1.4.1-x86_64.pkg.tar.zst
```

The native Arch package declares Arch library dependencies and adds Pofi to the application launcher. Use it instead of converting a Debian package. This packaging is independent of Omarchy's version. Pofi selects the session's native Wayland backend automatically (Hyprland) or X11 when appropriate. An explicit `--ozone-platform=x11` remains available for XWayland troubleshooting. Native notifications use the desktop's standard D-Bus notification service.

### Portable AppImage

AppImage is an alternative for Omarchy and distributions without a native package here. It still needs a graphical Linux session with GTK/NSS/audio libraries and glibc, and normally uses FUSE 2. If FUSE 2 is unavailable, use the runtime's extraction mode instead:

```sh
APPIMAGE_EXTRACT_AND_RUN=1 ./Pofi-1.4.1-x86_64.AppImage
```

Keep a portable AppImage in a directory you own if you want in-app updates. These binaries do not cover ARM/aarch64, Alpine/musl, obsolete Linux distributions, Windows or macOS. This is not a claim that every Linux distribution or physical Hyprland/GPU combination has been tested.

Open **Pofi** from your application launcher (or launch the AppImage). Focus and break completion use native Linux notifications and an audible chime. Allow Pofi notifications/sound in your desktop settings. Closing the window or choosing **Quit Pofi** ends the app and clears session statistics; minimize it to keep the session running. The computer must remain awake. Local phone pairing uses port **4317**.

## Choose your minutes

Drag the Focus slider (1–120 minutes) and Walk slider (1–30 minutes). Presets: 25, 45, 60 minutes. Default: 45 / 5. Durations are locked during a session; reset before changing them. Space starts/pauses. The round-completion count measures completed focus periods. Skipping does not count as completing a focus period.

When focus finishes, Pofi chimes once and keeps counting **+ overtime** in the focus phase. Click **“I’m up. Start walking”** to start the walk. You can also click **“Start 5-min walk early”** before the focus countdown ends: it records the actual work done and immediately starts a full walking break, without pausing or carrying the unfinished focus time into the walk. The default break is 5 minutes; a custom Walk duration still applies.

**Return early:** During a walk, click **“Start focusing early”** to record the actual walking time and immediately start a fresh full Focus period. This also works when the walk is paused; unused walking time is not counted or carried over.

When the walk finishes, Pofi chimes once and **stays in the walking phase**, showing **+ overtime**, just like focus overtime. Extra walking seconds are included in the live walking total and, when you end the walk, its session log entry. No focus session is counted and no focus time is charged until you click **“I’m back. Start focusing”** (or use **“Start focusing early”** before expiry). That click starts the full selected Focus duration. No phase or window changes automatically at the deadline. For example, a 5-minute walk followed by `+02:15` is logged as 7 minutes 15 seconds of walking. These are time totals, not measured distance or steps. Pause remains a separate action before expiry. Ignoring the focus reminder for a minute makes Pofi wilt; starting the walk revives the potato.

## This session’s totals and log

Focus sessions count once when a new focus phase starts, not on pause/resume. Total focus and walking times include overtime and exclude pauses. The session log records each ended focus/walk phase (including early resets/skips) with its duration and extra time. The ongoing phase is included in live totals and enters the log when it ends. Reset resets the timer, not session totals. Closing/quitting Pofi clears the timer, counts, totals and log, even across midnight; only chosen durations and sound preferences are saved. Refreshing a page or minimizing Pofi keeps the host process and its session alive.

## Updates from inside Pofi (1.1+)

Click **Check for updates**, then **Install Pofi …**. Source updates clone the fixed official repository, install lockfile dependencies, run tests and build only the matching format:

- Debian/Ubuntu: `.deb`, installed through `pkexec /usr/bin/dpkg --install`.
- Arch/Omarchy: `.pkg.tar.zst`, installed through `pkexec /usr/bin/pacman -U`.
- AppImage: replace the original user-writable AppImage atomically; no privileged installer is used.

Native updates ask for the system password through PolicyKit; dependency installation/builds run as your user. Failed tests/builds prevent installation. Source updates need Git, Node.js 24+ and npm. Debian build tools include `libarchive-tools`/`zstd`; Arch packaging tools include `libarchive`, `zstd` and `libxcrypt-compat` (for the portable FPM Ruby tool), plus a working PolicyKit authentication agent. For Arch source updates you can install prerequisites with `sudo pacman -S --needed git nodejs npm libarchive zstd libxcrypt-compat polkit base-devel`. Alternatively, simply download/install the newer prebuilt package from Releases. Other distributions should use the AppImage edition for in-app updates. TLS/package checksum checks stay enabled. Quit/reopen after installing; the session clears then. Maintainers must bump the package/lockfile version to offer an update.

For the first upgrade from **1.0**, which has no update button yet, quit Pofi and run:

```sh
cd "$HOME/Applications/Pofi"
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 24
git pull --ff-only
npm ci
npm test
npm run build:deb
sudo apt install ./dist/pofi_1.4.1_amd64.deb
```

## iPhone: stable pairing from any network (1.3+)

Deploy your own private relay using the repository's **Render Blueprint**:

[Deploy Pofi relay on Render](https://render.com/deploy?repo=https://github.com/Fzra27/Pofi)

1. Sign in to Render, connect this repository if prompted, and create the Blueprint. `render.yaml` defines a single free Node web service (`pofi-relay`), HTTPS and an automatically generated **POFI_RELAY_KEY**. Review the plan before creating it. No database or persistent disk is needed.
2. Wait for the service to show **Live**. Copy its public `https://…onrender.com` URL. In the service's **Environment** settings reveal/copy `POFI_RELAY_KEY`. Do not paste the key in chat or GitHub.
3. Update/reopen Pofi on your computer. Open **Pair iPhone → Internet pairing**. Paste the Render URL and key, then **Save connection**. Wait for **Connected**. The **Set up on Render** button opens the same deployment page.
4. Scan the new **internet** QR once with your iPhone camera. Open in Safari and tap **Enable this phone’s return chime**. The phone may use mobile data or any Wi-Fi; the desktop makes outbound HTTPS requests, so no router port forwarding is needed.
5. Keep the same Safari page or bookmark it. Pairing is stored in local/session storage and a first-party HttpOnly cookie. Phone URLs retain their private pairing fragment so a bookmark works even in a fresh/private browser context. Keep this private link to yourself. The desktop URL still removes its key from the address bar. The link/key stay stable across Pofi/relay restarts and computer IP changes, as long as the Render address and POFI_RELAY_KEY stay unchanged. After clearing Safari site data, reopen the full private pairing bookmark or scan the QR again. Rotating the Render key or recreating the service with a different address requires pairing again. If desktop app data is removed, re-enter the same Render URL/key to reconnect the existing phone link. Old LAN QR links do not become internet links; scan the internet QR once after enabling it.

The desktop must remain awake with Pofi running and Internet available. The relay forwards commands and current timer state; the desktop owns the timer. If disconnected, Safari shows **computer offline** and reconnects automatically when Pofi returns. Closing Pofi clears session statistics as before; the saved connection remains. One desktop installation should use each private relay. The key is stored in a mode-0600 desktop config file; only its derived phone key appears in the QR. Anyone with the phone link can control this timer. The relay operator can see timer state, including the session log; use your own private service. Changing the Render key invalidates old phone links; update the key in the computer and pair again.

Render's free service can sleep while unused; waking can take around a minute and connections retry. It is not an always-on availability guarantee. The phone screen must still stay awake with Safari foregrounded for reliable sound. HTTPS enables supported wake-lock/notification features, but **locked-screen iOS Web Push is not implemented**. Internet pairing does not by itself add background push notifications.

### Local Wi-Fi mode (no hosting needed)

Without Internet pairing configured, keep the computer/iPhone on the same Wi-Fi, choose the computer's Wi-Fi address under **Pair iPhone**, and scan. The local key now persists across desktop restarts; the IP address can still change. **Use local Wi-Fi only** disables Internet pairing on the computer. Permit TCP 4317 only from the local network if the computer firewall requires it. Do not forward the local port on your router.

### Self-host the relay

Use Node.js 24+ and a reverse proxy providing HTTPS. Set a random `POFI_RELAY_KEY` of at least 32 characters (keep it stable), set `PORT` if needed, run `npm ci --omit=dev --ignore-scripts`, then `npm run relay`. Electron is not downloaded or required for the relay. `/healthz` is the public health check; all timer and bridge APIs require authentication. A single process serves the relay; do not load balance multiple independent copies without shared state. The relay keeps only transient state/commands in memory. Restarting it does not change the derived phone key when its configured secret stays the same.

## Develop / build

Node.js **24+**, npm, Linux x64 for the desktop build:

```sh
npm ci
npm test
npm run desktop
npm run build:all
```

`postinstall` downloads the pinned official Electron binary with checksum verification. Behind a proxy, Node 24 can use inherited proxy settings with `NODE_USE_ENV_PROXY=1 npm ci`; keep your normal CA trust settings. `npm run build:all` creates Debian, Arch and AppImage assets without publishing. `npm run build:linux` remains a Debian-only compatibility alias so older installed updaters continue to work. For one target, use `npm run build:deb`, `npm run build:arch` or `npm run build:appimage`. Cross-building the Arch archive on Debian requires `libarchive-tools` and `zstd`. For web-only development, `npm start` prints a private local pairing URL. Use that URL, not a static file server; the Node process owns the synchronized timer. `PORT` and `POFI_DATA_DIR` are optional server overrides. Desktop state lives in Electron's per-user application data directory.

## Validation

`npm test` covers early walking before focus expires, full/default and custom walking durations, manual focus restart after walking, late tick walking overtime accounting, focus overtime, exactly-once alerts, pauses, session counts/logs, preferences-only persistence, paired-device access, stable local/internet pairing, relay authentication, host offline/reconnect and relay/desktop restarts, update version ordering and update failures that prevent privileged installation. Desktop and phone browser flows are checked with Chromium emulation; native notifications were exercised over a test D-Bus service. Tagged releases additionally install the native Arch package in a clean Arch container and exercise the actual Electron window/shared timer on X11; an AppImage launch test exercises the portable executable in extraction mode. Omarchy’s Arch/Hyprland basis was checked against its official manual; an actual Omarchy/Hyprland desktop is not available in CI. A real physical iPhone and the user's Ubuntu password dialog still require device-side confirmation. The local HTTP iOS foreground limitation remains unchanged.

### Recover pairing after upgrading from 1.3.0

If an old saved address says “Scan the internet pairing QR”, scan the current internet QR in Pofi once after installing 1.3.1 (and deploying the relay update). Bookmark the **full private phone URL**, including `#token=…`; do not share it. The 1.3.0 client stripped that fragment, so a previously saved bare address cannot recover a missing credential in a fresh Safari context. The fixed client also restores phone mode from its first-party cookie when reopening the bare origin in the same browser. Neither mechanism bypasses authentication when all credentials are gone.
