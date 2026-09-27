import { createFileRoute } from '@tanstack/react-router';
import { DevicesScreen } from '@/features/profile/screens/devices';

export const Route = createFileRoute('/_authenticated/devices')({
  component: () => <DevicesScreen />,
});
