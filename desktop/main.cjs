const {
  app,
  BrowserWindow,
  Notification,
  Menu,
  Tray,
  nativeImage,
  powerSaveBlocker,
  ipcMain,
  dialog,
} = require("electron");
const path = require("node:path");
const { startServer } = require("../server.cjs");
let win,
  service,
  tray,
  quitting = false,
  blocker;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    win?.show();
    win?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      service = await startServer({
        dataDir: app.getPath("userData"),
        port: 4317,
      });
      const icon = path.join(__dirname, "../public/icon.png");
      win = new BrowserWindow({
        width: 1160,
        height: 1020,
        minWidth: 410,
        minHeight: 680,
        title: "Pofi",
        icon,
        backgroundColor: "#f5f3eb",
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false,
          preload: path.join(__dirname, "preload.cjs"),
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (event, url) => {
        if (new URL(url).origin !== new URL(service.url).origin)
          event.preventDefault();
      });
      win.on("close", (e) => {
        if (!quitting) {
          quitting = true;
          app.quit();
        }
      });
      win.setMenuBarVisibility(false);
      tray = new Tray(
        nativeImage.createFromPath(icon).resize({ width: 24, height: 24 }),
      );
      tray.setToolTip("Pofi — focus & movement");
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: "Open Pofi", click: () => win.show() },
          {
            label: "Quit Pofi",
            click: () => {
              quitting = true;
              app.quit();
            },
          },
        ]),
      );
      tray.on("click", () => win.show());
      service.timer.on("alert", (event) => {
        const walk = event.type === "walk";
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: walk
              ? "Pofi — Time to walk!"
              : "Pofi — Come back refreshed!",
            body: walk
              ? `Stand up and take a ${service.timer.state.breakMinutes}-minute walk.`
              : "Your walking break is over. Time to return to your desk.",
            silent: !service.timer.state.sound,
            icon,
            urgency: "critical",
          });
          notification.on("click", () => {
            win.show();
            win.focus();
          });
          notification.show();
        }
        win.webContents.send("pofi-alert", event);
      });
      service.timer.on("change", () => {
        if (service.timer.state.running) {
          if (blocker === undefined)
            blocker = powerSaveBlocker.start("prevent-app-suspension");
        } else if (blocker !== undefined) {
          powerSaveBlocker.stop(blocker);
          blocker = undefined;
        }
      });
      const { Updater } = require("./updater.cjs");
      const updater = new Updater({
        workDir: path.join(app.getPath("userData"), "updates"),
        currentVersion: app.getVersion(),
        onProgress: (message) => win.webContents.send("pofi-update", message),
      });
      const trusted = (event) =>
        event.sender === win.webContents &&
        event.senderFrame === win.webContents.mainFrame;
      ipcMain.handle("pofi-update-check", async (event) => {
        if (!trusted(event)) throw new Error("Not allowed");
        return updater.check();
      });
      ipcMain.handle("pofi-update-install", async (event) => {
        if (!trusted(event)) throw new Error("Not allowed");
        const answer = await dialog.showMessageBox(win, {
          type: "question",
          buttons: ["Cancel", "Install update"],
          defaultId: 0,
          cancelId: 0,
          message: "Download, build and install Pofi from GitHub?",
          detail:
            "Your current session ends when you quit. Ubuntu will ask for your password to install the package. Reopen Pofi after installation.",
        });
        if (answer.response !== 1) return { cancelled: true };
        return updater.install();
      });
      await win.loadURL(service.url);
    })
    .catch((e) => {
      console.error(e);
      require("electron").dialog.showErrorBox(
        "Pofi could not start",
        e.message,
      );
      app.quit();
    });
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("will-quit", () => {
    service?.close();
  });
  app.on("window-all-closed", () => {});
}
