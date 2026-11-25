import { useDebouncedValue, useNow } from '@oppenheimer/design-system-mobile';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Search, Terminal } from '@oppenheimer/design-system-mobile/icons';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import {
  cloudProviderLabel,
  groupByProject,
  matchesQuery,
  type SessionEntity,
  sessionAgentLabel,
} from '@oppenheimer/frontend-consumer';
import { useHosts, useProjects, useSessions } from '@oppenheimer/frontend-consumer/react';
import { formatAge, ListGroup } from '@oppenheimer/frontend-mobile';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { FilterChips } from '../components/filter-chips';

import { SessionRow } from '../components/session-row';
import { SessionRowSkeleton } from '../components/session-row-skeleton';
import {
  askOf,
  dotOf,
  FILTER_LABEL,
  filterCounts,
  leadKeyOf,
  matchesFilter,
  needsInput,
  SESSION_FILTERS,
  type SessionFilter,
  sessionsListState,
} from '../lib/session-filters';

const SEARCH_SETTLE_MS = 150;
const AGE_TICK_MS = 60_000;

/**
 * Your sessions as the export lists them: search, the four chips, then the
 * ones waiting on you, then the rest by project. The list arrives whole, so
 * the search and the chips narrow it here; the field keeps what is typed and
 * hands the list the settled word.
 */
export function SessionsList() {
  const { t } = useTranslation();
  const sessions = useSessions();
  const projects = useProjects();
  const { data: hosts } = useHosts();
  const [typed, setTyped] = useState('');
  const query = useDebouncedValue(typed, SEARCH_SETTLE_MS);
  const [filter, setFilter] = useState<SessionFilter>('all');
  const now = useNow(AGE_TICK_MS);

  const search = (
    <View className="px-4 pt-3">
      <View className="h-11 flex-row items-center gap-2 rounded-md border border-border-default bg-card px-3">
        <Icon as={Search} size={16} className="text-ink-400" />
        <Input
          className="h-full flex-1 border-0 bg-transparent px-0"
          value={typed}
          onChangeText={setTyped}
          placeholder={t('sessions.sidebar.search')}
          accessibilityLabel={t('sessions.sidebar.search')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  );

  const state = sessionsListState([sessions, projects]);

  if (state === 'pending') {
    return (
      <View aria-busy>
        {search}
        <ListGroup title={t('sessions.sidebar.sessions')} count={null}>
          {[0, 1, 2].map((index) => (
            <SessionRowSkeleton key={index} first={index === 0} />
          ))}
        </ListGroup>
      </View>
    );
  }

  if (state === 'failed' || !sessions.data || !projects.data) {
    return (
      <View>
        {search}
        <View className="items-start gap-3 px-5 pt-6">
          <Text variant="body" tone="destructive">
            {t('sessions.sidebar.loadFailed')}
          </Text>
          <Button
            variant="outline"
            onPress={() => {
              if (sessions.isError) void sessions.refetch();
              if (projects.isError) void projects.refetch();
            }}
          >
            <Text>{t('common.retry')}</Text>
          </Button>
        </View>
      </View>
    );
  }

  const all = sessions.data;
  const groupedBy = projects.data;
  const counts = filterCounts(all);
  const shown = all.filter((s) => matchesFilter(s, filter) && matchesQuery(s, query));
  const waiting = shown.filter(needsInput);
  const groups = groupByProject(
    groupedBy,
    shown.filter((s) => !needsInput(s)),
  ).filter((group) => group.sessions.length > 0);

  const projectName = (id: string) =>
    groupedBy.find((project) => project.id === id)?.name ?? t('sessions.sidebar.unfiled');
  const placeOf = (session: SessionEntity) =>
    session.cloud
      ? cloudProviderLabel(session.cloud.provider)
      : (hosts?.find((host) => host.id === session.hostId)?.name ?? '');
  const row = (session: SessionEntity, index: number, lead: string) => {
    const agent = sessionAgentLabel(session.agent);
    return (
      <Link key={session.id} href={`/sessions/${session.id}`} asChild>
        <Pressable accessibilityRole="button" className="active:bg-surface-hover">
          <SessionRow
            first={index === 0}
            name={session.name}
            agentInitial={agent.charAt(0)}
            dot={dotOf(session)}
            meta={[lead, agent, placeOf(session)].filter(Boolean).join(' · ')}
            ask={needsInput(session) ? askOf(session) : null}
            age={formatAge(session.lastEventAt ?? session.createdAt, now, t)}
          />
        </Pressable>
      </Link>
    );
  };

  const empty =
    all.length === 0
      ? t('sessions.sidebar.noSessionsPhone')
      : query.trim()
        ? t('sessions.sidebar.noMatches', { query: query.trim() })
        : t('sessions.filters.noMatches');

  return (
    <View className="gap-1 pb-6">
      {search}
      <View className="pt-3">
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={SESSION_FILTERS.map((value) => ({
            value,
            count: counts[value],
            label: t(FILTER_LABEL[value]),
          }))}
        />
      </View>

      {waiting.length > 0 ? (
        <ListGroup
          title={t('sessions.session.state.waiting-on-you')}
          count={waiting.length}
          attention
        >
          {waiting.map((session, index) => row(session, index, projectName(session.projectId)))}
        </ListGroup>
      ) : null}

      {groups.map((group) => (
        <ListGroup
          key={group.project?.id ?? 'unfiled'}
          title={group.project?.name ?? t('sessions.sidebar.unfiled')}
          count={group.sessions.length}
        >
          {group.sessions.map((session, index) => row(session, index, t(leadKeyOf(session))))}
        </ListGroup>
      ))}

      {waiting.length === 0 && groups.length === 0 ? (
        <View className="px-4 pt-10">
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Icon as={Terminal} size={24} />
              </EmptyState.Media>
              <EmptyState.Description>{empty}</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        </View>
      ) : null}
    </View>
  );
}
