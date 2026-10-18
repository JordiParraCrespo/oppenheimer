// Oppenheimer desktop, spike: the hosted console in a window, plus one bridge
// to the runner on this machine (its 0600 Unix socket), so a session whose host
// is this machine is attached with no network in between.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');

const CONSOLE_URL = process.env.OPPENHEIMER_CONSOLE_URL ?? 'http://localhost:3000';
const RUNNER_HOME = process.env.RUNNER_HOME || path.join(os.homedir(), '.oppenheimer');
const SOCKET = path.join(RUNNER_HOME, 'run', 'runner.sock');

function runnerGet(route) {
  return new Promise((resolve, reject) => {
    const req = http.get({ socketPath: SOCKET, path: route, timeout: 2000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () =>
        res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error(`${res.statusCode}`)),
      );
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

const attachments = new Map();
let nextHandle = 1;

ipcMain.handle('local:has-session', async (_e, id) => {
  try {
    const s = await runnerGet(`/v1/sessions/${encodeURIComponent(id)}`);
    return Boolean(s && s.id === id);
  } catch {
    return false;
  }
});

ipcMain.handle('local:attach', (event, id, window, cols, rows) => {
  const handle = nextHandle++;
  const url = `ws+unix://${SOCKET}:/v1/sessions/${encodeURIComponent(id)}/attach?window=${window}&cols=${cols}&rows=${rows}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    ws.binaryType = 'nodebuffer';
    let open = false;
    ws.on('open', () => {
      open = true;
      ws._socket.setNoDelay?.(true);
      attachments.set(handle, ws);
      resolve(handle);
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary && !event.sender.isDestroyed()) event.sender.send('local:data', handle, data);
    });
    ws.on('close', () => {
      attachments.delete(handle);
      if (open && !event.sender.isDestroyed()) event.sender.send('local:close', handle);
    });
    ws.on('error', (err) => {
      if (!open) reject(err);
    });
  });
});

ipcMain.on('local:write', (_e, handle, data) =>
  attachments.get(handle)?.send(Buffer.from(data, 'utf8'), { binary: true }),
);
ipcMain.on('local:resize', (_e, handle, cols, rows) =>
  attachments.get(handle)?.send(JSON.stringify({ type: 'resize', cols, rows })),
);
ipcMain.on('local:close', (_e, handle) => attachments.get(handle)?.close());

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Oppenheimer',
    webPreferences: {
      // OPPENHEIMER_NO_BRIDGE=1 is the console as a browser sees it (the relay), for comparison.
      preload: process.env.OPPENHEIMER_NO_BRIDGE ? undefined : path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  const origin = new URL(CONSOLE_URL).origin;
  // The window is the console and nothing else; every other link opens in the
  // system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== origin) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  win.loadURL(CONSOLE_URL);
  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
