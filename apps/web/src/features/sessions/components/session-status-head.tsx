import type { ReactNode } from 'react';

/**
 * The head of a session's wait (`SessionsConsole.dc.html`, `op-provision`):
 * an eyebrow, the wait as a title, and a muted lead line. "Starting your
 * session" opens with it, and so does the chat while its history arrives.
 */
export function SessionStatusHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: ReactNode;
  /** Drawn even when there is none, as the provisioning pane always has. */
  lead: string | null;
}) {
  return (
    <>
      {eyebrow ? <p className="figures text-micro text-fg-muted uppercase">{eyebrow}</p> : null}
      <h1 className="mt-2 font-display text-h2 font-semibold text-fg">{title}</h1>
      <p className="mt-1.5 text-operate text-fg-muted">{lead}</p>
    </>
  );
}
