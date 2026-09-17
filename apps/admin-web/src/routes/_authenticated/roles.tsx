import { createFileRoute } from '@tanstack/react-router';
import { RolesScreen } from '@/features/roles/screens/roles';

export const Route = createFileRoute('/_authenticated/roles')({
  component: RolesScreen,
});
