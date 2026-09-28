import type { ReactNode } from 'react';

/**
 * The last resort's page, for a URL that matched no route at all and for
 * anything thrown above the layouts — a signed-out reader on a mistyped link, a
 * chunk that would not load. Inside the product these are the `_authenticated`
 * layout's, which keeps the sidebar; there is no chrome to keep out here, so
 * the page is the message.
 */
export function RootFallback({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col justify-center bg-canvas px-6 py-10">{children}</div>
  );
}
