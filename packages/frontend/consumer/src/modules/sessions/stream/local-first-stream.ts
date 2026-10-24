import type { SessionStream, StreamEnd, StreamPath, StreamStatus } from './session-stream';

/**
 * Terminals on this machine, reached without the network: the runner's local
 * socket, through whatever shell the console runs in. The desktop app supplies
 * one (`product/research/desktop-app-spike.md`); a browser supplies none, and
 * the platform binds it at composition (`localTerminalsModule`), so nothing
 * here knows which shell it is.
 */
export interface LocalTerminals {
  /** Whether the runner on this machine holds the session. */
  hasSession(sessionId: string): Promise<boolean>;
  attach(sessionId: string, window: number, cols: number, rows: number): Promise<number>;
  write(handle: number, data: string): void;
  resize(handle: number, cols: number, rows: number): void;
  /**
   * Bytes the terminal has drained. The shell stops reading the runner while
   * too many are outstanding, so a slow pane leaves its backlog in tmux, as
   * the relay's credit window does (01, "Flow control").
   */
  credit(handle: number, bytes: number): void;
  close(handle: number): void;
  onData(handle: number, listener: (chunk: Uint8Array) => void): () => void;
  onClose(handle: number, listener: () => void): () => void;
}

type DataListener = (chunk: Uint8Array | string, consumed: () => void) => void;

/**
 * Local first, the relay otherwise: asks the bridge whether this machine's
 * runner holds the session, attaches through its socket if so, and hands the
 * whole stream to `remote()` (the attach socket, with its direct path) if not
 * or if the local attach fails. Listeners registered before the choice are
 * replayed onto whichever stream wins.
 */
export class LocalFirstSessionStream implements SessionStream {
  private readonly dataListeners = new Set<DataListener>();
  private readonly statusListeners = new Set<(s: StreamStatus) => void>();
  private readonly endListeners = new Set<(r: StreamEnd) => void>();
  private readonly pathListeners = new Set<(p: StreamPath) => void>();
  private remoteStream: SessionStream | null = null;
  private handle: number | null = null;
  private disposed = false;
  private viewport = { cols: 80, rows: 24 };
  private path: StreamPath | null = null;
  private unsubscribe: (() => void)[] = [];
  private remoteStatus: StreamStatus = 'connecting';

  constructor(
    private readonly bridge: LocalTerminals,
    private readonly sessionId: string,
    private readonly window: number,
    private readonly remote: () => SessionStream,
  ) {
    void this.choose();
  }

  private async choose(): Promise<void> {
    let local = false;
    try {
      local = await this.bridge.hasSession(this.sessionId);
    } catch {
      local = false;
    }
    if (this.disposed) return;
    if (!local) return this.goRemote();
    try {
      const handle = await this.bridge.attach(
        this.sessionId,
        this.window,
        this.viewport.cols,
        this.viewport.rows,
      );
      if (this.disposed) return this.bridge.close(handle);
      this.handle = handle;
      this.unsubscribe.push(
        this.bridge.onData(handle, (chunk) => {
          // One credit per chunk, however many listeners drain it.
          let credited = false;
          const consumed = () => {
            if (credited) return;
            credited = true;
            this.bridge.credit(handle, chunk.byteLength);
          };
          for (const listener of this.dataListeners) listener(chunk, consumed);
        }),
        this.bridge.onClose(handle, () => {
          // The runner went (a restart, an update) or the window closed: fall
          // back to the relay, which knows which of the two it was.
          if (this.disposed || this.handle !== handle) return;
          this.handle = null;
          this.goRemote();
        }),
      );
      this.setPath('local');
      for (const listener of this.statusListeners) listener('live');
    } catch {
      this.goRemote();
    }
  }

  private goRemote(): void {
    if (this.disposed || this.remoteStream) return;
    const stream = this.remote();
    this.remoteStream = stream;
    // One subscription per kind, fanned out to the sets, so the sets stay the
    // only record of who listens and unsubscribing works whenever it happens.
    this.unsubscribe.push(
      stream.onData((chunk, consumed) => {
        for (const l of this.dataListeners) l(chunk, consumed);
      }),
      stream.onStatus((status) => {
        this.remoteStatus = status;
        for (const l of this.statusListeners) l(status);
      }),
      stream.onEnd((reason) => {
        for (const l of this.endListeners) l(reason);
      }),
    );
    if (stream.onPath) {
      this.unsubscribe.push(stream.onPath((p) => this.setPath(p)));
    } else {
      this.setPath('relay');
    }
    stream.resize(this.viewport.cols, this.viewport.rows);
  }

  private status(): StreamStatus {
    if (this.handle !== null) return 'live';
    return this.remoteStream ? this.remoteStatus : 'connecting';
  }

  private setPath(path: StreamPath): void {
    this.path = path;
    for (const listener of this.pathListeners) listener(path);
  }

  onData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onStatus(listener: (status: StreamStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status());
    return () => this.statusListeners.delete(listener);
  }

  onEnd(listener: (reason: StreamEnd) => void): () => void {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  onPath(listener: (path: StreamPath) => void): () => void {
    this.pathListeners.add(listener);
    if (this.path) listener(this.path);
    return () => this.pathListeners.delete(listener);
  }

  send(data: string): void {
    if (this.handle !== null) this.bridge.write(this.handle, data);
    else this.remoteStream?.send(data);
  }

  resize(cols: number, rows: number): void {
    this.viewport = { cols, rows };
    if (this.handle !== null) this.bridge.resize(this.handle, cols, rows);
    else this.remoteStream?.resize(cols, rows);
  }

  reconnectNow(): void {
    this.remoteStream?.reconnectNow();
  }

  dispose(): void {
    this.disposed = true;
    for (const off of this.unsubscribe) off();
    if (this.handle !== null) this.bridge.close(this.handle);
    this.remoteStream?.dispose();
  }
}
