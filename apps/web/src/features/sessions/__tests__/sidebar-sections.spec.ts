// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { movedSection, sectionOrder, steppedSection } from '../lib/sidebar-sections';

describe('the sessions sidebar section order', () => {
  it('draws every section once from a stored order that is empty, stale or repeated', () => {
    // Regression: an unknown or doubled id left a section undrawn or drawn twice.
    expect(sectionOrder([])).toEqual(['bots', 'sessions']);
    expect(sectionOrder(['sessions'])).toEqual(['sessions', 'bots']);
    expect(sectionOrder(['gone', 'sessions', 'sessions', 'bots'])).toEqual(['sessions', 'bots']);
  });

  it('puts the dropped section where the one it lands on stood', () => {
    expect(movedSection(['bots', 'sessions'], 'bots', 'sessions')).toEqual(['sessions', 'bots']);
    expect(movedSection(['sessions', 'bots'], 'bots', 'sessions')).toEqual(['bots', 'sessions']);
  });

  it('keeps the order when the drop lands on itself or on nothing it knows', () => {
    // Regression: a drop on the group itself (its id is no section) reshuffled the order.
    expect(movedSection(['bots', 'sessions'], 'bots', 'bots')).toEqual(['bots', 'sessions']);
    expect(movedSection(['bots', 'sessions'], 'bots', 'sidebar-sections')).toEqual([
      'bots',
      'sessions',
    ]);
  });

  it('steps a section one place from the keyboard and stays put past either end', () => {
    // Regression: a step past the end moved the section onto `undefined`.
    expect(steppedSection(['bots', 'sessions'], 'bots', 1)).toEqual(['sessions', 'bots']);
    expect(steppedSection(['sessions', 'bots'], 'bots', -1)).toEqual(['bots', 'sessions']);
    expect(steppedSection(['bots', 'sessions'], 'bots', -1)).toEqual(['bots', 'sessions']);
    expect(steppedSection(['bots', 'sessions'], 'sessions', 1)).toEqual(['bots', 'sessions']);
  });
});
