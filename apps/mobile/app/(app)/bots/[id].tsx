import { useLocalSearchParams } from 'expo-router';
import { BotScreen } from '../../../features/bots/screens/bot';

export default function BotRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BotScreen id={id} />;
}
