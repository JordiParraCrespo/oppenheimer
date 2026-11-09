import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SectionBotsRowsSkeleton } from '@/features/bots/components/section-bots-rows-skeleton';
import { rememberedBotCount, sectionBotCounts } from '@/features/bots/lib/section-bot-count';

afterEach(cleanup);

const rows = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="bot-item-skeleton"]').length;

// The regression: a fixed row count moved the sidebar under it by the
// difference when the list answered (71px over an empty section).
describe("a section's bots placeholder", () => {
  it('draws as many rows as the section listed last time on this device', () => {
    sectionBotCounts.write('pulls', '5');
    const { container } = render(<SectionBotsRowsSkeleton count={rememberedBotCount('pulls')} />);
    expect(rows(container)).toBe(5);
  });

  it('draws the empty line, not rows, for a section that listed none', () => {
    sectionBotCounts.write('plan', '0');
    const { container } = render(<SectionBotsRowsSkeleton count={rememberedBotCount('plan')} />);
    expect(rows(container)).toBe(0);
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('draws one row before the first visit', () => {
    expect(rememberedBotCount('automations')).toBeNull();
    const { container } = render(<SectionBotsRowsSkeleton count={null} />);
    expect(rows(container)).toBe(1);
  });
});
