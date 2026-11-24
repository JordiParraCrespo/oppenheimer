import { ErrorAlert, PageBar, usePaneDrop } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NewSessionBackdrop } from '../components/new-session-backdrop';
import { NewSessionBackgroundMenu } from '../components/new-session-background-menu';
import { useDrawnTabs } from '../hooks/use-drawn-tabs';
import { useNewSessionBackground } from '../hooks/use-new-session-background';
import { NewSessionDropContext, useNewSessionDrop } from '../hooks/use-new-session-drop';
import { NewSessionForm } from '../sections/new-session-form';

/**
 * New session, the console's pane when nothing is open, on the grey ground
 * the shell lays under every pane, so the white composer reads as the one
 * surface. The screen only composes; every read belongs to the section.
 *
 * The shell frames it at the `prompt` measure, at the pane's foot
 * (`routes/_authenticated/sessions/new.tsx`), and the pane takes its drops (`usePaneDrop`): files
 * dropped anywhere in the window are handed to the composer, which holds the
 * task's files, and the pane draws the outline on its own edge.
 *
 * The reader may lay an image of their own under the pane, from the button
 * on its bar's right; it is kept on this device and shown on this
 * screen only (`lib/new-session-background.ts`).
 *
 * The screen draws its bar. With tabs open elsewhere it is the tab bar: the
 * open tabs (`tabs`, from the route), kept as they were, that button on its
 * right, on the pane's own ground, the image only under the content below.
 * With none, it is the page's quiet bar: the sidebar toggle and that button
 * on frosted chips, over an image that runs to the top.
 */
export function NewSessionScreen({ tabs }: { tabs: ReactNode }) {
  const { t } = useTranslation();
  const drop = useNewSessionDrop();
  usePaneDrop(drop.deliver);
  const background = useNewSessionBackground();

  const hasTabs = useDrawnTabs(null).drawn.length > 0;
  const menu = (
    <NewSessionBackgroundMenu
      hasImage={background.image !== null}
      onChoose={background.choose}
      onRemove={background.remove}
    />
  );

  return (
    <NewSessionDropContext value={drop}>
      {background.image ? (
        <NewSessionBackdrop image={background.image} under={hasTabs ? 'content' : 'pane'} />
      ) : null}
      {hasTabs ? (
        <PageBar title={tabs} tone="chrome" actions={menu} />
      ) : (
        <PageBar title={null} actions={menu} className="bg-transparent" />
      )}
      <div className="flex flex-col gap-2.5">
        {background.failure ? (
          <ErrorAlert
            message={t(`sessions.new.background.${background.failure}`)}
            onDismiss={background.dismiss}
          />
        ) : null}
        <NewSessionForm
          heading={
            <h1 className="mb-3.5 ml-1 font-display text-h2 font-semibold text-fg">
              {t('sessions.new.heading')}
            </h1>
          }
        />
      </div>
    </NewSessionDropContext>
  );
}
