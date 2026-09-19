import { createFileRoute } from '@tanstack/react-router';
import { SessionScreen } from '@/features/sessions/screens/session';

export const Route = createFileRoute('/_authenticated/sessions/$sessionId')({
  component: SessionScreen,
});
