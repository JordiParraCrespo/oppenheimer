import { useLocalSearchParams } from 'expo-router';
import { SessionScreen } from '../../../features/sessions/screens/session';
import { webUrl } from '../../../lib/auth-client';

export default function SessionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionScreen id={id} webUrl={webUrl} />;
}
