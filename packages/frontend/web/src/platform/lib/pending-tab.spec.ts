import { afterEach, describe, expect, it, vi } from 'vitest';
import { openPendingTab } from './pending-tab';

/**
 * The tab "Manage repository access" opens: opened in the click so a popup
 * blocker allows it, pointed at GitHub once the address arrives, and telling
 * the console when the reader comes back so the installations are read again
 * (without that, the picker kept the list from before the install).
 */

afterEach(() => vi.restoreAllMocks());

function fakeTab() {
  return { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
}

describe('openPendingTab', () => {
  it('cuts the opener and sends the tab to the address once it arrives', () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);

    openPendingTab().go('https://github.com/apps/x/installations/new?state=s');

    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe('https://github.com/apps/x/installations/new?state=s');
  });

  it('runs onReturn once when this window gets focus back', () => {
    vi.spyOn(window, 'open').mockReturnValue(fakeTab() as unknown as Window);
    const onReturn = vi.fn();

    openPendingTab({ onReturn });
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('closes the tab and stops listening when the address never comes', () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const onReturn = vi.fn();

    openPendingTab({ onReturn }).close();
    window.dispatchEvent(new Event('focus'));

    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(onReturn).not.toHaveBeenCalled();
  });
});
