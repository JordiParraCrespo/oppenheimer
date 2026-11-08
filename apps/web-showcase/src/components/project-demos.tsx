'use client';

import { ProjectCard, ProjectCardGrid, ProjectCardSkeleton } from '@oppenheimer/design-system-web/project-card';
import {
  ProjectMilestoneRow,
  ProjectOverview,
  ProjectOverviewColumn,
  ProjectPanel,
  ProjectPanelEmpty,
  ProjectTaskRow,
} from '@oppenheimer/design-system-web/project-overview';
import { StatusDot } from '@oppenheimer/design-system-web/status-dot';

export function ProjectCardsDemo() {
  return (
    <div className="flex w-full flex-col gap-6">
      <ProjectCardGrid>
        <ProjectCard
          name="XRP Mobile"
          meta="xrp-mobile"
          status={<StatusDot density="compact" state="needs-input" />}
        />
        <ProjectCard
          name="Atlas"
          meta="atlas · flama-ai"
          status={<StatusDot density="compact" state="running" />}
        />
        <ProjectCard name="Client sites" meta="flama-ai · adri-rodriguez-sites" status={<StatusDot density="compact" state="idle" />} />
        <ProjectCardSkeleton />
      </ProjectCardGrid>
      <ProjectOverview>
        <ProjectOverviewColumn>
          <ProjectPanel label="Milestones">
            <ProjectPanelEmpty>No milestones yet.</ProjectPanelEmpty>
          </ProjectPanel>
          <ProjectPanel label="Milestones">
            <ProjectMilestoneRow name="Android biometric unlock" done={1} total={4} />
            <ProjectMilestoneRow name="App Store release" done={3} total={3} />
          </ProjectPanel>
        </ProjectOverviewColumn>
        <ProjectOverviewColumn>
          <ProjectPanel label="Needs input">
            <ProjectTaskRow state="needs-input" reason="Waiting on a decision" title="Biometric unlock on Android" due="Nov 12" />
          </ProjectPanel>
          <ProjectPanel label="In progress">
            <ProjectTaskRow state="running" title="Rotate the signing keys" due="Nov 10" />
            <ProjectTaskRow state="running" title="Wallet balance widget" />
          </ProjectPanel>
        </ProjectOverviewColumn>
      </ProjectOverview>
    </div>
  );
}
