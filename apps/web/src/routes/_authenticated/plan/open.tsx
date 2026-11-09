import { createFileRoute } from '@tanstack/react-router';
import { PlanOpenScreen } from '@/features/tasks/screens/plan-open';

/**
 * Plan's front door, where the rail's Plan item and the console's landing
 * point: the screen redirects to the first view Plan's sidebar shows, the
 * Inbox until the reader drags another above it.
 */
export const Route = createFileRoute('/_authenticated/plan/open')({
  component: PlanOpenScreen,
});
