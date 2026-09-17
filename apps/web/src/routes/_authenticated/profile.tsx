import { createFileRoute } from '@tanstack/react-router';
import { ProfileScreen } from '@/features/profile/screens/profile';

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  return <ProfileScreen />;
}
