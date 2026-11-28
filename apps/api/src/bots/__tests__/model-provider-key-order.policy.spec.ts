import { keysInTurnOrder } from '../domain/model-provider-key-order.policy';

/**
 * The order a call tries a provider's keys in. What breaks if this regresses:
 * a turn keeps landing on the key that ran out of credit while the next has
 * some, or a workspace whose keys are all spent stops trying the one most
 * likely topped up since.
 */
const at = (iso: string) => new Date(iso);
const key = (id: string, position: number, spentAt: Date | null, createdAt = at('2026-11-01')) => ({
  id,
  position,
  spentAt,
  createdAt,
});

describe('keysInTurnOrder', () => {
  it('tries the keys not spent first, in the order the workspace set', () => {
    const order = keysInTurnOrder([
      key('third', 2, null),
      key('first', 0, at('2026-11-20')),
      key('second', 1, null),
    ]);
    expect(order.map((k) => k.id)).toEqual(['second', 'third', 'first']);
  });

  it('breaks a tie in position by the older key, so two added at once keep one order', () => {
    const order = keysInTurnOrder([
      key('newer', 1, null, at('2026-11-02')),
      key('older', 1, null, at('2026-11-01')),
    ]);
    expect(order.map((k) => k.id)).toEqual(['older', 'newer']);
  });

  it('with every key spent, tries the one spent longest ago first', () => {
    const order = keysInTurnOrder([key('a', 0, at('2026-11-20')), key('b', 1, at('2026-11-10'))]);
    expect(order.map((k) => k.id)).toEqual(['b', 'a']);
  });
});
