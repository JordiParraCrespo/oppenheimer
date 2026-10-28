import {
  IconButton,
  SessionList,
  SidebarProjectGroup,
  SidebarProjectHeader,
  useNow,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import type { AutomationEntity, ProjectEntity } from '@oppenheimer/frontend-consumer';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { useTranslation } from 'react-i18next';
import { AutomationSidebarRow } from './automation-sidebar-row';

/**
 * One project's group in the automations sidebar: the folding header with
 * New automation in it, then its automations. A project with none has no
 * group, so `items` is empty only while a search hides the group anyway.
 *
 * The group owns its ages' clock, ticking once a minute: every row's meta and
 * run ages may have moved, and the sidebar around the groups — its search, its
 * head — does not redraw for it.
 */
export function AutomationGroup({
  project,
  items,
  open,
  onOpenChange,
  onNew,
}: {
  project: ProjectEntity;
  items: AutomationEntity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNew: (project: ProjectEntity) => void;
}) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);

  return (
    <SidebarProjectGroup>
      <SidebarProjectHeader
        name={project.name}
        count={items.length}
        open={open}
        onOpenChange={onOpenChange}
        actions={
          <IconButton
            size="xs"
            variant="quiet"
            aria-label={t('automations.sidebar.newHere', { name: project.name })}
            onClick={() => onNew(project)}
          >
            <Plus />
          </IconButton>
        }
      />
      {open && items.length ? (
        <SessionList>
          {items.map((automation) => (
            <AutomationSidebarRow key={automation.id} automation={automation} now={now} />
          ))}
        </SessionList>
      ) : null}
    </SidebarProjectGroup>
  );
}
