// The one thing the console sees of the desktop: `window.oppenheimerDesktop`.
const { contextBridge, ipcRenderer } = require('electron');

const dataListeners = new Map();
const closeListeners = new Map();
ipcRenderer.on('local:data', (_e, handle, data) => {
  const chunk = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  for (const l of dataListeners.get(handle) ?? []) l(chunk);
});
ipcRenderer.on('local:close', (_e, handle) => {
  for (const l of closeListeners.get(handle) ?? []) l();
});
function on(map, handle, listener) {
  if (!map.has(handle)) map.set(handle, new Set());
  map.get(handle).add(listener);
  return () => map.get(handle)?.delete(listener);
}

contextBridge.exposeInMainWorld('oppenheimerDesktop', {
  version: 1,
  hasSession: (id) => ipcRenderer.invoke('local:has-session', id),
  attach: (id, window, cols, rows) => ipcRenderer.invoke('local:attach', id, window, cols, rows),
  write: (handle, data) => ipcRenderer.send('local:write', handle, data),
  resize: (handle, cols, rows) => ipcRenderer.send('local:resize', handle, cols, rows),
  credit: (handle, bytes) => ipcRenderer.send('local:credit', handle, bytes),
  close: (handle) => ipcRenderer.send('local:close', handle),
  onData: (handle, listener) => on(dataListeners, handle, listener),
  onClose: (handle, listener) => on(closeListeners, handle, listener),
});
