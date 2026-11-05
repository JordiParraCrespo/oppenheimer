import { Wordmark } from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import type { ConsoleList } from '@/lib/console';

/** New bot loads with the Employees list, like its sidebar. */
const NewBotButton = lazy(() =>
  import('@/features/bots/sections/new-bot-button').then((module) => ({
    default: module.NewBotButton,
  })),
);

/**
 * The sidebar's brand row: the wordmark alone, not the workspace (version 1
 * has one workspace per account), and on the Employees list the plus that
 * makes a bot, where the design puts it. Route composition beside the
 * layout that mounts it, like the sidebar body.
 *
 * The wordmark is a real link to `/`, the console's front door, so it opens
 * in a new tab like any other link.
 */
export function ConsoleBrand({ list }: { list: ConsoleList }) {
  return (
    <>
      <Link
        to="/"
        className="rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Wordmark size={18} />
      </Link>
      {list === 'bots' ? (
        <Suspense fallback={null}>
          <NewBotButton />
        </Suspense>
      ) : null}
    </>
  );
}
