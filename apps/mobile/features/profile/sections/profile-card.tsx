import { Avatar, AvatarFallback } from '@oppenheimer/design-system-mobile/avatar';
import { Skeleton } from '@oppenheimer/design-system-mobile/skeleton';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useProfile } from '@oppenheimer/frontend-core/react';
import { View } from 'react-native';
import { initials } from '../lib/initials';

export function ProfileCard() {
  const { data: user, isLoading } = useProfile();

  return (
    <View className="flex-row items-center gap-3.5 rounded-2xl border border-border-subtle bg-card p-4">
      <Avatar alt={user?.fullName ?? ''} className="size-11">
        <AvatarFallback>
          <Text variant="body">{user ? initials(user.firstName, user.lastName) : ''}</Text>
        </AvatarFallback>
      </Avatar>
      {isLoading ? (
        <View className="flex-1 gap-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </View>
      ) : (
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="large" numberOfLines={1}>
            {user?.fullName}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
      )}
    </View>
  );
}
