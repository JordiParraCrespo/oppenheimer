import { useLocalSearchParams } from 'expo-router';
import { AutomationScreen } from '../../../features/automations/screens/automation';

export default function AutomationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AutomationScreen id={id} />;
}
