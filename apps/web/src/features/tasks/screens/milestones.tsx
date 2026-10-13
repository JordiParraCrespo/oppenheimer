import type { MilestoneTimelineControls } from '@oppenheimer/design-system-web';
import { useRef, useState } from 'react';
import { MilestoneDialog } from '../dialogs/milestone';
import { useScopeProject } from '../hooks/use-scope-project';
import { MilestonesHeader } from '../sections/milestones-header';
import { MilestonesTimeline } from '../sections/milestones-timeline';
import { PlanFilters } from '../sections/plan-filters';

/**
 * Plan's Milestones (the 2026-10-13 `Tasks` frame): the header, the Project
 * filter and the timeline. The header's buttons move the timeline and open New
 * milestone; a milestone on it opens its edit dialog. The screen holds what the
 * two share: the timeline's handle and which milestone the dialog is for.
 */
export function MilestonesScreen() {
  const { projectId } = useScopeProject();
  const timeline = useRef<MilestoneTimelineControls>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <div className="flex flex-col gap-7">
      <MilestonesHeader
        onToday={() => timeline.current?.today()}
        onEarlier={() => timeline.current?.earlier()}
        onLater={() => timeline.current?.later()}
        onNew={() => setEditing('new')}
      />
      <PlanFilters />
      <MilestonesTimeline
        controls={timeline}
        onEdit={(id) => setEditing(id)}
        onNew={() => setEditing('new')}
      />
      {editing ? (
        <MilestoneDialog
          milestoneId={editing === 'new' ? undefined : editing}
          projectId={projectId || undefined}
          onClose={() => setEditing(null)}
          onDeleted={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
