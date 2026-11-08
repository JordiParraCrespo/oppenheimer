import { createFileRoute } from '@tanstack/react-router';
import { PersonMemoryScreen } from '@/features/bots/screens/person-memory';

/** Settings → Memory: what the person's bots know about them, and what they wrote for them. */
export const Route = createFileRoute('/_authenticated/settings/memory')({
  component: PersonMemoryScreen,
});
