import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { CircleOff, Terminal } from '@oppenheimer/design-system-web/icons';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A run whose terminal is gone.
 *
 * The session's own stopped pane says "this session has stopped" and offers
 * Restart and New session, and neither sentence is a run's. 16 §Resume puts it
 * exactly: *a run's turn ends; its session does not*. What a reader wants from
 * a finished run is to see what it did and, if they mean to carry on, to take
 * the session over interactively — "Open in terminal", which is the same
 * `--resume` a restart uses, described the way a run's reader thinks about it.
 * Starting an unrelated session is not a step from here, so there is no New
 * session; the way out is back to the automation that owns the run.
 *
 * What is still missing is the run transcript beside the terminal (13, "not
 * built"), which is the headless slice's structured output. Until it lands
 * this is the frame's shape without its left-hand column, and the branch is
 * the one concrete thing a reader can follow.
 */
export function RunClosed({
  branch,
  onOpen,
  opening,
  backToAutomation,
}: {
  /** The run's branch, when its worktree still names one. */
  branch: string | null;
  onOpen: () => void;
  opening: boolean;
  backToAutomation: ReactElement;
}) {
  const { t } = useTranslation();

  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <CircleOff />
        </EmptyState.Media>
        <EmptyState.Title>{t('automations.runClosed.title')}</EmptyState.Title>
        <EmptyState.Description>
          {branch
            ? t('automations.runClosed.description', { branch })
            : t('automations.runClosed.descriptionNoBranch')}
        </EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button
          onClick={onOpen}
          pending={opening}
          pendingLabel={t('automations.runClosed.opening')}
        >
          <Terminal />
          {t('automations.runClosed.open')}
        </Button>
        <Button variant="secondary" render={backToAutomation}>
          {t('automations.runClosed.backToAutomation')}
        </Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
