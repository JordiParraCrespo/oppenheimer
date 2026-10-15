import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { CANCEL_POLL_MS, TurnCancelWatchFactory } from '../turn-cancel-watch.factory';

/**
 * The watch a running turn keeps for Stop: one read at a time however slow
 * the database is, a failed read logged and the watch still looking, Stop
 * aborting the signal, and a stopped watch reading nothing more. The turn's
 * runner using it is the handler spec's.
 */
function setup(isCancelRequested: () => Promise<boolean>, timeLimitMs?: number) {
  const turns = { isCancelRequested: vi.fn(isCancelRequested) } satisfies Pick<
    BotTurnRepositoryPort,
    'isCancelRequested'
  >;
  const factory = new TurnCancelWatchFactory(turns as unknown as BotTurnRepositoryPort);
  return { turns, watch: factory.watch('turn-1', timeLimitMs) };
}

describe('TurnCancelWatchFactory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts the signal when Stop is pressed, and reads no more', async () => {
    let asked = false;
    const { turns, watch } = setup(async () => asked);
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 2);
    expect(watch.signal.aborted).toBe(false);
    asked = true;
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS);
    expect(watch.signal.aborted).toBe(true);
    const reads = turns.isCancelRequested.mock.calls.length;
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 5);
    expect(turns.isCancelRequested).toHaveBeenCalledTimes(reads);
  });

  it('aborts a turn that runs past its time limit, and says it was the limit', async () => {
    const { watch } = setup(async () => false, CANCEL_POLL_MS * 4);
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 4 - 1);
    expect(watch.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(watch.signal.aborted).toBe(true);
    expect(watch.timedOut).toBe(true);
  });

  it('reports Stop as Stop, not as the limit, when Stop comes first', async () => {
    let asked = false;
    const { watch } = setup(async () => asked, CANCEL_POLL_MS * 4);
    asked = true;
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 8);
    expect(watch.signal.aborted).toBe(true);
    expect(watch.timedOut).toBe(false);
  });

  it('keeps looking after a read fails', async () => {
    let calls = 0;
    const { turns, watch } = setup(async () => {
      calls += 1;
      if (calls === 1) throw new Error('connection reset');
      return calls === 3;
    });
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 3);
    expect(turns.isCancelRequested).toHaveBeenCalledTimes(3);
    expect(watch.signal.aborted).toBe(true);
  });

  it('never starts a read while the last one is still out', async () => {
    let settle: (asked: boolean) => void = () => undefined;
    const { turns } = setup(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 10);
    expect(turns.isCancelRequested).toHaveBeenCalledTimes(1);
    settle(false);
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS);
    expect(turns.isCancelRequested).toHaveBeenCalledTimes(2);
  });

  it('reads nothing once stopped, and never aborts', async () => {
    const { turns, watch } = setup(async () => true);
    watch.stop();
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 5);
    expect(turns.isCancelRequested).not.toHaveBeenCalled();
    expect(watch.signal.aborted).toBe(false);
  });

  it('does not abort for a read that settles after it was stopped', async () => {
    let settle: (asked: boolean) => void = () => undefined;
    const { watch } = setup(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS);
    watch.stop();
    settle(true);
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS);
    expect(watch.signal.aborted).toBe(false);
  });
});
