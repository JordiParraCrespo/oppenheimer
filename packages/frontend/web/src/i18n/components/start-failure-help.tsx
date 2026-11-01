import { Callout, Link } from '@oppenheimer/design-system-web';
import type { FailureHelp } from '../lib/start-failure';

/**
 * A failed start's help note: what the reason line cannot say, in the
 * reader's language, with the page that fixes it a link away.
 */
export function StartFailureHelp({ help, className }: { help: FailureHelp; className?: string }) {
  return (
    <Callout className={className}>
      {help.body}{' '}
      <Link href={help.href} target="_blank" rel="noreferrer">
        {help.link}
      </Link>
    </Callout>
  );
}
