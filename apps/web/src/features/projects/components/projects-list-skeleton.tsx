import { ProjectCardGrid, ProjectCardSkeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/** The projects before they answer: three cards on the card's own frame. */
export function ProjectsListSkeleton() {
  return (
    <section aria-busy>
      <LoadingStatus />
      <ProjectCardGrid aria-hidden>
        <ProjectCardSkeleton />
        <ProjectCardSkeleton />
        <ProjectCardSkeleton />
      </ProjectCardGrid>
    </section>
  );
}
