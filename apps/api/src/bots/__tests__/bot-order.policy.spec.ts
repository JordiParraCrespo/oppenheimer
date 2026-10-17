import { placeInOrder } from '../domain/bot-order.policy';

/**
 * The sidebar's drag: where one bot (or group) lands among the others. The
 * repository writes positions 0…n-1 from this order; the integration spec
 * covers that it does, under a lock.
 */
describe('placeInOrder', () => {
  const order = ['a', 'b', 'c'];

  it('moves an item up and down among its siblings', () => {
    expect(placeInOrder(order, 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(placeInOrder(order, 'a', 1)).toEqual(['b', 'a', 'c']);
  });

  it('puts an item last, whether it was there before or arrives from elsewhere', () => {
    expect(placeInOrder(order, 'a', 'last')).toEqual(['b', 'c', 'a']);
    expect(placeInOrder(order, 'z', 'last')).toEqual(['a', 'b', 'c', 'z']);
  });

  it('clamps an index past the end to last, and below zero to first', () => {
    expect(placeInOrder(order, 'a', 99)).toEqual(['b', 'c', 'a']);
    expect(placeInOrder(order, 'c', -3)).toEqual(['c', 'a', 'b']);
  });
});
