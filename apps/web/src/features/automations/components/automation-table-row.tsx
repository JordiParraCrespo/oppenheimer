import { RoutineTableRow } from '@oppenheimer/design-system-web';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { automationDot } from '../lib/automation-view';
import { AutomationRowMenu } from './automation-row-menu';
import { NextRun } from './next-run';
import { TriggerGlyph } from './trigger-glyph';

/**
 * One row of the overview's table: glyph, name over agent · model · project,
 * the trigger in words, the next run with its countdown, the status and the
 * ellipsis. The menu's open state is the row's: nothing above it reads it.
 */
export function AutomationTableRow({
  automation,
  subline,
  trigger,
  onOpen,
  onEdit,
  onRunNow,
  onTogglePause,
  onDuplicate,
  onDelete,
}: {
  automation: AutomationEntity;
  subline: string;
  trigger: string;
  onOpen: () => void;
  onEdit: () => void;
  onRunNow: () => void;
  onTogglePause: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <RoutineTableRow
      tabIndex={0}
      aria-label={automation.name}
      icon={<TriggerGlyph scheduled={automation.isScheduled} size={15} />}
      name={automation.name}
      sub={subline}
      trigger={trigger}
      next={<NextRun automation={automation} />}
      status={automationDot(automation)}
      statusLabel={t(`automations.status.${automation.status}`)}
      paused={automation.isPaused}
      menuOpen={menuOpen}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen();
        }
      }}
      action={
        <AutomationRowMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          paused={automation.isPaused}
          onEdit={onEdit}
          onRunNow={onRunNow}
          onTogglePause={onTogglePause}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      }
    />
  );
}
