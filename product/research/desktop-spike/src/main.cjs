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

// handle -> { ws, owner, inflight, paused }. An attachment belongs to the page
// that opened it, and only that page may drive it.
const attachments = new Map();
let nextHandle = 1;

// The credit window, as on the relay (01, "Flow control"): past HIGH bytes the
// page has not drained, stop reading the socket, which stalls the runner's
// write and its PTY read and leaves the backlog in tmux; read again below LOW.
const HIGH = 1024 * 1024;
const LOW = 256 * 1024;

function closeOwnedBy(ownerId) {
  for (const a of attachments.values()) if (a.owner === ownerId) a.ws.close();
}

// A page that reloads, navigates or is destroyed never runs its cleanup, and
// on macOS the app outlives its windows: its attachments go with it.
const watched = new Set();
function watch(contents) {
  if (watched.has(contents.id)) return;
  watched.add(contents.id);
  const id = contents.id;
  contents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) closeOwnedBy(id);
  });
  contents.once('destroyed', () => {
    watched.delete(id);
    closeOwnedBy(id);
  });
}

function owned(event, handle) {
  const a = attachments.get(handle);
  return a && a.owner === event.sender.id ? a : undefined;
}

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
  const sender = event.sender;
  watch(sender);
  const url = `ws+unix://${SOCKET}:/v1/sessions/${encodeURIComponent(id)}/attach?window=${window}&cols=${cols}&rows=${rows}`;
  return new Promise((resolve, reject) => {
    // A dial that never opens or fails would leave the page waiting forever.
    const ws = new WebSocket(url, { perMessageDeflate: false, handshakeTimeout: 5000 });
    ws.binaryType = 'nodebuffer';
    const a = { ws, owner: sender.id, inflight: 0, paused: false };
    let open = false;
    ws.on('open', () => {
      open = true;
      ws._socket.setNoDelay?.(true);
      attachments.set(handle, a);
      resolve(handle);
    });
    ws.on('message', (data, isBinary) => {
      if (!isBinary || sender.isDestroyed()) return;
      a.inflight += data.length;
      if (!a.paused && a.inflight > HIGH) {
        a.paused = true;
        ws.pause();
      }
      sender.send('local:data', handle, data);
    });
    ws.on('close', () => {
      attachments.delete(handle);
      if (open && !sender.isDestroyed()) sender.send('local:close', handle);
    });
    ws.on('error', (err) => {
      if (!open) reject(err);
    });
  });
});

ipcMain.on('local:credit', (event, handle, bytes) => {
  const a = owned(event, handle);
  if (!a) return;
  a.inflight = Math.max(0, a.inflight - bytes);
  if (a.paused && a.inflight < LOW) {
    a.paused = false;
    a.ws.resume();
  }
});
ipcMain.on('local:write', (event, handle, data) =>
  owned(event, handle)?.ws.send(Buffer.from(data, 'utf8'), { binary: true }),
);
ipcMain.on('local:resize', (event, handle, cols, rows) =>
  owned(event, handle)?.ws.send(JSON.stringify({ type: 'resize', cols, rows })),
);
ipcMain.on('local:close', (event, handle) => owned(event, handle)?.ws.close());

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
