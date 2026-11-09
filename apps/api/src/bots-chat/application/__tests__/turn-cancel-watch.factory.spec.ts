import { LOOP_GUARD_DATA_KEY } from '@oppenheimer/backend-agents';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BOT_TURN_LOOP_REFUSALS } from '../../domain/bot-turn.entity';
import { CANCEL_POLL_MS, TurnCancelWatchFactory } from '../turn-cancel-watch.factory';

/**
 * The watch a running turn keeps for Stop, a silent model and a loop: one
 * read at a time however slow the database is, a failed read logged and the
 * watch still looking, Stop aborting the signal, a stopped watch reading
 * nothing more; no clock on the turn itself, only on the model's silence
 * while none of its tools runs; and the loop guard's refusals counted. The
 * turn's runner using it is the handler spec's.
 */
function setup(isCancelRequested: () => Promise<boolean>, idleLimitMs?: number) {
  const turns = { isCancelRequested: vi.fn(isCancelRequested) } satisfies Pick<
    BotTurnRepositoryPort,
    'isCancelRequested'
  >;
  const factory = new TurnCancelWatchFactory(turns as unknown as BotTurnRepositoryPort);
  return { turns, watch: factory.watch('turn-1', idleLimitMs) };
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

  // What breaks this: a long turn stopped at a clock, which is what stopped
  // bots mid-work (2026-11-09); or a hung model holding a worker for ever.
  it('stops a turn only when its model says nothing for the idle limit', async () => {
    const { watch } = setup(async () => false, CANCEL_POLL_MS * 4);
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 3);
      watch.saw({ type: 'text.delta', text: 'still going' });
    }
    expect(watch.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 4);
    expect(watch.signal.aborted).toBe(true);
    expect(watch.interruption).toBe('stalled');
  });

  it('does not count a tool that takes long as silence, nor a provider retry’s wait', async () => {
    const { watch } = setup(async () => false, CANCEL_POLL_MS * 4);
    watch.saw({ type: 'tool.started', callId: 'c1', name: 'run_command', input: {} });
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 40);
    expect(watch.signal.aborted).toBe(false);
    watch.saw({
      type: 'tool.finished',
      callId: 'c1',
      name: 'run_command',
      output: 'ok',
      isError: false,
    });
    watch.saw({ type: 'retrying', reason: 'rate_limit', delayMs: CANCEL_POLL_MS * 10 });
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 12);
    expect(watch.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 3);
    expect(watch.interruption).toBe('stalled');
  });

  it(`stops a turn whose calls the loop guard refused ${BOT_TURN_LOOP_REFUSALS} times`, () => {
    const { watch } = setup(async () => false);
    const refused = {
      type: 'tool.finished' as const,
      callId: 'c',
      name: 'check',
      output: 'Not run',
      isError: true,
      data: { [LOOP_GUARD_DATA_KEY]: 'refused' },
    };
    for (let i = 1; i < BOT_TURN_LOOP_REFUSALS; i++) watch.saw(refused);
    expect(watch.signal.aborted).toBe(false);
    watch.saw(refused);
    expect(watch.interruption).toBe('loop');
  });

  it('reports Stop as Stop, not as a stall, when Stop comes first', async () => {
    let asked = false;
    const { watch } = setup(async () => asked, CANCEL_POLL_MS * 4);
    asked = true;
    await vi.advanceTimersByTimeAsync(CANCEL_POLL_MS * 8);
    expect(watch.signal.aborted).toBe(true);
    expect(watch.interruption).toBe('stop');
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
