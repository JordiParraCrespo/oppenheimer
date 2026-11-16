import { useLocalSearchParams } from 'expo-router';
import { TaskScreen } from '../../../features/tasks/screens/task';

export default function TaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskScreen id={id} />;
}
