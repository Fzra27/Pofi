const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pofiDesktop", {
  openRelaySetup: () => ipcRenderer.invoke("pofi-remote-setup"),
  remoteStatus: () => ipcRenderer.invoke("pofi-remote-status"),
  saveRemote: (config) => ipcRenderer.invoke("pofi-remote-save", config),
  disableRemote: () => ipcRenderer.invoke("pofi-remote-disable"),
  checkUpdate: () => ipcRenderer.invoke("pofi-update-check"),
  installUpdate: () => ipcRenderer.invoke("pofi-update-install"),
  onUpdate: (callback) =>
    ipcRenderer.on("pofi-update", (_event, message) => callback(message)),
  onAlert: (callback) =>
    ipcRenderer.on("pofi-alert", (_event, data) => callback(data)),
});
