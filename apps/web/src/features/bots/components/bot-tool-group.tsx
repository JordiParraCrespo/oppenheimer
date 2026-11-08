import { Disclosure, DisclosurePanel, DisclosureTrigger } from '@oppenheimer/design-system-web';
import { type ReactNode, useState } from 'react';

/**
 * One group of tools in Settings → Permissions, folded to a line: its name,
 * and on the right while folded how its tools stand ("8 tools · 2 ask"). The
 * rows are the caller's.
 *
 * The reader opens and folds it; when the list starts or stops being
 * narrowed, it follows: open while a filter shows its matches, folded again
 * once the filter clears. That is state adjusted to a prop, the way React
 * documents it, rather than a remount.
 */
export function BotToolGroup({
  label,
  summary,
  filtering,
  children,
}: {
  label: string;
  summary: string;
  /** Whether a search or dropdown narrows the list. */
  filtering: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(filtering);
  const [followed, setFollowed] = useState(filtering);
  if (followed !== filtering) {
    setFollowed(filtering);
    setOpen(filtering);
  }

  return (
    <Disclosure open={open} onOpenChange={setOpen}>
      <DisclosureTrigger tone="muted" summary={summary} className="px-1 py-1">
        <span className="eyebrow">{label}</span>
      </DisclosureTrigger>
      <DisclosurePanel className="mt-1.5">{children}</DisclosurePanel>
    </Disclosure>
  );
}
