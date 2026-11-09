const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pofiDesktop", {
  checkUpdate: () => ipcRenderer.invoke("pofi-update-check"),
  installUpdate: () => ipcRenderer.invoke("pofi-update-install"),
  onUpdate: (callback) =>
    ipcRenderer.on("pofi-update", (_event, message) => callback(message)),
  onAlert: (callback) =>
    ipcRenderer.on("pofi-alert", (_event, data) => callback(data)),
});
