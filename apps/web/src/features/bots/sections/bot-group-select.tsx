import { FieldSelect, SettingsRow } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useBotGroups, useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/** The picker's value for Ungrouped; a group id is a uuid, so the two never meet. */
const UNGROUPED = 'ungrouped';

/**
 * Sidebar group, a row of the Profile card: Ungrouped or one of the
 * workspace's groups, saved as it is picked, the bot going last in its new
 * group. A new group is made where groups live, in the sidebar beside the
 * chat, which the hint links to. The groups are this picker's own read: the
 * card around it never waits on them.
 */
export function BotGroupSelect({ bot }: { bot: BotEntity }) {
  const { t } = useTranslation();
  const { data: groups = [] } = useBotGroups();
  const update = useUpdateBot();
  const groupId = update.isPending ? update.variables.input.groupId : bot.groupId;

  return (
    <>
      <SettingsRow
        label={t('bots.settings.profile.group')}
        hint={
          <>
            {t('bots.settings.profile.groupHint')} ·{' '}
            <Link to="/bots/$botId" params={{ botId: bot.id }} className="text-link">
              {t('bots.settings.profile.newGroup')}
            </Link>
          </>
        }
        control="field"
      >
        <FieldSelect
          aria-label={t('bots.settings.profile.group')}
          value={groupId ?? UNGROUPED}
          onValueChange={(value) =>
            update.mutate({ id: bot.id, input: { groupId: value === UNGROUPED ? null : value } })
          }
          options={[
            { value: UNGROUPED, label: t('bots.sidebar.ungrouped') },
            ...groups.map((group) => ({ value: group.id, label: group.name })),
          ]}
          placeholder={t('bots.sidebar.ungrouped')}
          searchPlaceholder={t('bots.settings.profile.searchGroups')}
          emptyText={(query) => t('bots.settings.profile.noGroup', { query })}
        />
      </SettingsRow>
      <ErrorAlert
        error={update.error}
        fallback={t('bots.settings.profile.failed')}
        onDismiss={() => update.reset()}
        className="mx-5 mb-4"
      />
    </>
  );
}
