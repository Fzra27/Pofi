const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pofiDesktop", {
  onAlert: (callback) =>
    ipcRenderer.on("pofi-alert", (_event, data) => callback(data)),
});
