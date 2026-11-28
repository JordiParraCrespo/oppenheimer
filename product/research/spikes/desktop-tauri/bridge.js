// The one thing the console sees of the desktop: `window.oppenheimerDesktop`,
// the same `LocalTerminals` contract the Electron spike's preload exposes
// (packages/frontend/consumer/src/modules/sessions/stream/local-first-stream.ts),
// built on Tauri's IPC. Injected by the shell before the console's own scripts.
(() => {
  if (window !== window.top || window.oppenheimerDesktop) return;
  const ipc = window.__TAURI_INTERNALS__;
  if (!ipc) return;
  const invoke = (cmd, args) => ipc.invoke(cmd, args);

  // handle -> its attachment: one queue for output nobody listens to yet,
  // and its listeners. Each attach owns its own, so two terminals attaching
  // at once never take each other's output.
  const attachments = new Map();

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
    const a = { queue: [], data: new Set(), close: new Set(), ended: false };
    const deliver = (buffer) => {
      const chunk = new Uint8Array(buffer);
      if (a.data.size) for (const l of a.data) l(chunk);
      else a.queue.push(chunk);
    };
    let handle;
    const closed = () => {
      a.ended = true;
      for (const l of a.close) l();
      attachments.delete(handle);
    };
    handle = await invoke('local_attach', {
      id,
      window: windowIndex,
      cols,
      rows,
      onData: channel(deliver, closed),
    });
    if (!a.ended) attachments.set(handle, a);
    return handle;
  }

  function on(handle, kind, listener) {
    const a = attachments.get(handle);
    if (!a) return () => {};
    a[kind].add(listener);
    return () => a[kind].delete(listener);
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
      const off = on(handle, 'data', listener);
      const a = attachments.get(handle);
      if (a?.queue.length) for (const chunk of a.queue.splice(0)) listener(chunk);
      return off;
    },
    onClose: (handle, listener) => on(handle, 'close', listener),
  });
})();
