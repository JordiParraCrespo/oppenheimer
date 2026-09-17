import { useAuthState } from '@oppenheimer/frontend-core/react';
import { Redirect } from 'expo-router';

export default function Index() {
  const { isAuthenticated } = useAuthState();
  return <Redirect href={isAuthenticated ? '/(app)' : '/(auth)/login'} />;
}
