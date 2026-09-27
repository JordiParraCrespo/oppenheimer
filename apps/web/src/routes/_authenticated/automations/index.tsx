import { createFileRoute } from '@tanstack/react-router';
import { AutomationsTable } from '@/features/automations/sections/automations-table';

/** The overview on its Automations tab: the table. */
export const Route = createFileRoute('/_authenticated/automations/')({
  component: AutomationsTable,
});
