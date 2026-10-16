import { FieldSelect, SettingsRow } from '@oppenheimer/design-system-web';
import { useBotGroups } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { BotProfileControl } from '@/features/bots/forms/bot-profile-form';

/** The picker's value for Ungrouped; a group id is a uuid, so the two never meet. */
const UNGROUPED = 'ungrouped';

/**
 * Sidebar group, a row of the Profile card: Ungrouped or one of the
 * workspace's groups, a pick in the card's draft; saved, the bot goes last
 * in its new group. A new group is made where groups live, in the sidebar
 * beside the chat, which the hint links to. The groups are this picker's own
 * read: the card around it never waits on them.
 */
export function BotGroupSelect({ botId, control }: { botId: string; control: BotProfileControl }) {
  const { t } = useTranslation();
  const { data: groups = [] } = useBotGroups();
  const { field } = useController({ control, name: 'groupId' });

  return (
    <SettingsRow
      label={t('bots.settings.profile.group')}
      hint={
        <>
          {t('bots.settings.profile.groupHint')} ·{' '}
          <Link to="/bots/$botId" params={{ botId }} className="text-link">
            {t('bots.settings.profile.newGroup')}
          </Link>
        </>
      }
      control="field"
    >
      <FieldSelect
        aria-label={t('bots.settings.profile.group')}
        value={field.value ?? UNGROUPED}
        onValueChange={(value) => field.onChange(value === UNGROUPED ? null : value)}
        options={[
          { value: UNGROUPED, label: t('bots.sidebar.ungrouped') },
          ...groups.map((group) => ({ value: group.id, label: group.name })),
        ]}
        placeholder={t('bots.sidebar.ungrouped')}
        searchPlaceholder={t('bots.settings.profile.searchGroups')}
        emptyText={(query) => t('bots.settings.profile.noGroup', { query })}
      />
    </SettingsRow>
  );
}
