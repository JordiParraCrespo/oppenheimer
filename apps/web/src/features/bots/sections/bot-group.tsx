import {
  BotList,
  SidebarEmptyRow,
  SidebarProjectGroup,
  SidebarProjectHeader,
  useNow,
} from '@oppenheimer/design-system-web';
import type { BotGroupEntity } from '@oppenheimer/frontend-consumer';
import { useDeleteBotGroup, useRenameBotGroup } from '@oppenheimer/frontend-consumer/react';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GroupMenu } from '@/features/bots/components/group-menu';
import { GroupNameInput } from '@/features/bots/components/group-name-input';
import type { BotSection } from '@/features/bots/lib/bot-groups';
import { BotSidebarRow } from './bot-sidebar-row';

/**
 * One section of the Employees sidebar: its eyebrow head with the count and,
 * for a group of the reader's, Rename group and Delete group; then its bots,
 * or a line saying the group is empty. Ungrouped has no menu. A rename is
 * typed in the head's place. The section owns its ages' minute clock, so a
 * tick redraws its rows and not the sidebar's search or the other sections.
 */
export function BotGroup({
  section,
  groups,
  open,
  onOpenChange,
  searching,
}: {
  section: BotSection;
  /** Every group, for the rows' Move pane. */
  groups: readonly BotGroupEntity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A search is narrowing the list: an empty group then says nothing. */
  searching: boolean;
}) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  const [renaming, setRenaming] = useState(false);
  const rename = useRenameBotGroup({ onSettled: () => setRenaming(false) });
  const remove = useDeleteBotGroup();
  const { group, bots } = section;
  const name = group ? group.name : t('bots.sidebar.ungrouped');

  return (
    <SidebarProjectGroup>
      {group && renaming ? (
        <GroupNameInput
          defaultValue={group.name}
          pending={rename.isPending}
          onCommit={(next) =>
            next === group.name ? setRenaming(false) : rename.mutate({ id: group.id, name: next })
          }
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <SidebarProjectHeader
          tone="eyebrow"
          name={name}
          count={bots.length}
          open={open}
          onOpenChange={onOpenChange}
          actions={
            group ? (
              <GroupMenu
                name={group.name}
                onRename={() => setRenaming(true)}
                onDelete={() => remove.mutate(group.id)}
              />
            ) : undefined
          }
        />
      )}
      <ErrorAlert
        error={rename.error ?? remove.error}
        fallback={t('bots.sidebar.groupFailed')}
        onDismiss={() => {
          rename.reset();
          remove.reset();
        }}
        className="my-1"
      />
      {open && bots.length ? (
        <BotList>
          {bots.map((bot) => (
            <BotSidebarRow key={bot.id} bot={bot} groups={groups} now={now} />
          ))}
        </BotList>
      ) : null}
      {open && !bots.length && !searching ? (
        <SidebarEmptyRow>{t('bots.sidebar.emptyGroup')}</SidebarEmptyRow>
      ) : null}
    </SidebarProjectGroup>
  );
}
