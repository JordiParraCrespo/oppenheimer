'use client';

import type { UpdateUserSettingsDto } from '@oppenheimer/shared/schemas/profile';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { UserSettingsEntity } from '../modules/user-settings/user-settings.entity';
import { useOppenheimerApp } from './context';
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

export function useUpdateUserSettings(
  options?: UseMutationOptions<UserSettingsEntity, Error, UpdateUserSettingsDto>,
) {
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateUserSettingsDto) => app.userSettings.update(dto),
    ...options,
    onSuccess: (...args) => {
      const [settings] = args;
      queryClient.setQueryData(userSettingsKeys.me(), settings);
      options?.onSuccess?.(...args);
    },
  });
}
