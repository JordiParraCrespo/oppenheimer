'use client';
import { type UseQueryOptions } from '@tanstack/react-query';
import type { UserSettingsEntity } from '../modules/user-settings/user-settings.entity';
import { useOppenheimerApp } from './context';
import { useQuery } from './query';
import { userSettingsKeys } from './query-keys';

export { userSettingsKeys };

export function useUserSettings(
  options?: Omit<UseQueryOptions<UserSettingsEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useOppenheimerApp();

  return useQuery({
    queryKey: userSettingsKeys.me(),
    queryFn: () => app.userSettings.get(),
    ...options,
  });
}
