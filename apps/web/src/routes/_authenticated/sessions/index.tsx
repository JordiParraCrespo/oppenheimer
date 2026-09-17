import { createFileRoute } from '@tanstack/react-router';
import { SessionsScreen } from '@/features/sessions/screens/sessions';

export const Route = createFileRoute('/_authenticated/sessions/')({ component: SessionsScreen });
