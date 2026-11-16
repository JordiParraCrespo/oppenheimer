// The one thing the console sees of the desktop: `window.oppenheimerDesktop`,
// the same `LocalTerminals` contract the Electron spike's preload exposes
// (packages/frontend/consumer/src/modules/sessions/stream/local-first-stream.ts),
// built on Tauri's IPC. Injected by the shell before the console's own scripts.
(() => {
  if (window !== window.top || window.oppenheimerDesktop) return;
  const ipc = window.__TAURI_INTERNALS__;
  if (!ipc) return;
  const invoke = (cmd, args) => ipc.invoke(cmd, args);

  const dataListeners = new Map();
  const closeListeners = new Map();
  // Chunks that arrive before the page has subscribed to its handle.
  const early = new Map();

  function on(map, handle, listener) {
    if (!map.has(handle)) map.set(handle, new Set());
    map.get(handle).add(listener);
    return () => map.get(handle)?.delete(listener);
  }

  // A Tauri channel, by hand: Rust calls back with `{ message, index }` per
  // chunk and `{ end, index }` when it drops the channel. Large chunks are
  // fetched, so they can resolve out of order: deliver them by index.
  function channel(onMessage, onEnd) {
    let next = 0;
    let endAt = -1;
    const queue = new Map();
    const id = ipc.transformCallback((m) => {
      if (m.end) endAt = m.index;
      else queue.set(m.index, m.message);
      while (queue.has(next)) {
        const message = queue.get(next);
        queue.delete(next);
        next++;
        onMessage(message);
      }
      if (endAt === next) onEnd();
    });
    return `__CHANNEL__:${id}`;
  }

  async function attach(id, windowIndex, cols, rows) {
    let handle;
    // Chunks that arrive before this attach resolves stay with this attach:
    // two terminals attaching at once must not take each other's output.
    const pending = [];
    const deliver = (buffer) => {
      const chunk = new Uint8Array(buffer);
      if (handle === undefined) return void pending.push(chunk);
      const listeners = dataListeners.get(handle);
      if (listeners?.size) for (const l of listeners) l(chunk);
      else {
        if (!early.has(handle)) early.set(handle, []);
        early.get(handle).push(chunk);
      }
    };
    const closed = () => {
      for (const l of closeListeners.get(handle) ?? []) l();
      dataListeners.delete(handle);
      closeListeners.delete(handle);
      early.delete(handle);
    };
    handle = await invoke('local_attach', {
      id,
      window: windowIndex,
      cols,
      rows,
      onData: channel(deliver, closed),
    });
    if (pending.length) early.set(handle, pending);
    return handle;
  }

  window.oppenheimerDesktop = Object.freeze({
    version: 1,
    shell: 'tauri',
    hasSession: (id) => invoke('local_has_session', { id }),
    attach,
    write: (handle, data) => void invoke('local_write', { handle, data }),
    resize: (handle, cols, rows) => void invoke('local_resize', { handle, cols, rows }),
    credit: (handle, bytes) => void invoke('local_credit', { handle, bytes }),
    close: (handle) => void invoke('local_close', { handle }),
    onData: (handle, listener) => {
      const off = on(dataListeners, handle, listener);
      const backlog = early.get(handle);
      if (backlog) {
        early.delete(handle);
        for (const chunk of backlog) listener(chunk);
      }
      return off;
    },
    onClose: (handle, listener) => on(closeListeners, handle, listener),
  });
})();
