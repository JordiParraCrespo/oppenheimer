import { Wordmark } from '@oppenheimer/design-system-web';
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
 */
export function ConsoleBrand({ list }: { list: ConsoleList }) {
  return (
    <>
      <Wordmark size={18} />
      {list === 'bots' ? (
        <Suspense fallback={null}>
          <NewBotButton />
        </Suspense>
      ) : null}
    </>
  );
}
