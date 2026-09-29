import {
  IconButton,
  SessionList,
  SidebarEmptyRow,
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
 * New automation in it, then its automations or the empty row.
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
  searching,
  onNew,
}: {
  project: ProjectEntity;
  items: AutomationEntity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A search is narrowing the list: an empty group then says nothing. */
  searching: boolean;
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
      {open && !items.length && !searching ? (
        <SidebarEmptyRow>
          {t('automations.sidebar.emptyProject')}{' '}
          <button type="button" onClick={() => onNew(project)}>
            {t('automations.sidebar.createOne')}
          </button>
        </SidebarEmptyRow>
      ) : null}
    </SidebarProjectGroup>
  );
}
