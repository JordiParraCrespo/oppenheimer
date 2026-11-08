import { Disclosure, DisclosurePanel, DisclosureTrigger } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';

/**
 * One group of tools in Settings → Permissions, folded to a line: its name,
 * and on the right while folded how its tools stand ("8 tools · 2 ask"). The
 * rows are the caller's.
 */
export function BotToolGroup({
  label,
  summary,
  defaultOpen,
  children,
}: {
  label: string;
  summary: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      <DisclosureTrigger tone="muted" summary={summary} className="px-1 py-1">
        <span className="eyebrow">{label}</span>
      </DisclosureTrigger>
      <DisclosurePanel className="mt-1.5">{children}</DisclosurePanel>
    </Disclosure>
  );
}
