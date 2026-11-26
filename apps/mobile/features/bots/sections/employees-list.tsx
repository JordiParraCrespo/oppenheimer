import { useDebouncedValue, useNow } from '@oppenheimer/design-system-mobile';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Bot } from '@oppenheimer/design-system-mobile/icons';
import { SearchField } from '@oppenheimer/design-system-mobile/search-field';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { botGroupSections } from '@oppenheimer/frontend-consumer';
import { useBotGroups, useBots } from '@oppenheimer/frontend-consumer/react';
import { formatAge, ListGroup } from '@oppenheimer/frontend-mobile';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { BotRow } from '../components/bot-row';
import { EmployeesRowSkeleton } from '../components/employees-row-skeleton';
import { previewLine } from '../lib/preview-line';

const SEARCH_SETTLE_MS = 150;
const AGE_TICK_MS = 60_000;

/**
 * Your employees as the export lists them: search, then each group in the
 * console's order with its bots by position, then the ones in no group. A
 * row opens the bot's chat. The search narrows by name, as the console's
 * sidebar does; the field keeps what is typed and hands the list the
 * settled word.
 */
export function EmployeesList() {
  const { t } = useTranslation();
  const bots = useBots();
  const groups = useBotGroups();
  const [typed, setTyped] = useState('');
  const query = useDebouncedValue(typed, SEARCH_SETTLE_MS);
  const now = useNow(AGE_TICK_MS);

  const search = (
    <View className="px-4 pt-3">
      <SearchField onQueryChange={setTyped} placeholder={t('bots.mobile.search')} />
    </View>
  );

  if (bots.isPending || groups.isPending) {
    return (
      <View aria-busy>
        {search}
        <ListGroup title={null} count={null}>
          {[0, 1, 2].map((index) => (
            <EmployeesRowSkeleton key={index} first={index === 0} />
          ))}
        </ListGroup>
      </View>
    );
  }

  if ((bots.isError && !bots.data) || (groups.isError && !groups.data)) {
    return (
      <View>
        {search}
        <View className="items-start gap-3 px-5 pt-6">
          <Text variant="body" tone="destructive">
            {t('bots.mobile.loadFailed')}
          </Text>
          <Button
            variant="outline"
            onPress={() => {
              void bots.refetch();
              void groups.refetch();
            }}
          >
            <Text>{t('common.retry')}</Text>
          </Button>
        </View>
      </View>
    );
  }

  const sections = botGroupSections(bots.data ?? [], groups.data ?? [], query).filter(
    (section) => section.bots.length > 0,
  );

  return (
    <View className="gap-1 pb-6">
      {search}
      {sections.map((section) => (
        <ListGroup
          key={section.id ?? 'ungrouped'}
          title={section.group?.name ?? (sections.length > 1 ? t('bots.mobile.ungrouped') : null)}
          count={section.bots.length}
        >
          {section.bots.map((bot, index) => (
            <Link key={bot.id} href={`/bots/${bot.id}`} asChild>
              <Pressable accessibilityRole="button" className="active:bg-surface-hover">
                <BotRow
                  first={index === 0}
                  name={bot.name}
                  initials={bot.initials}
                  color={bot.avatarColor}
                  line={
                    previewLine(bot.lastMessagePreview || bot.description) ||
                    t('bots.sidebar.noMessages')
                  }
                  age={formatAge(bot.lastActivityAt, now, t)}
                />
              </Pressable>
            </Link>
          ))}
        </ListGroup>
      ))}
      {sections.length === 0 ? (
        <View className="px-4 pt-10">
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Icon as={Bot} size={24} />
              </EmptyState.Media>
              <EmptyState.Description>
                {query.trim()
                  ? t('bots.mobile.noMatches', { query: query.trim() })
                  : t('bots.mobile.empty')}
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        </View>
      ) : null}
    </View>
  );
}
