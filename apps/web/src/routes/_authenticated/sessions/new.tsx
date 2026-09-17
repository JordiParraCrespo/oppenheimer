import { createFileRoute } from '@tanstack/react-router';
import { NewSessionScreen } from '@/features/sessions/screens/new-session';

export const Route = createFileRoute('/_authenticated/sessions/new')({
  component: NewSessionScreen,
});
