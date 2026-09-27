import { createFileRoute } from '@tanstack/react-router';
import { RunsTable } from '@/features/automations/sections/runs-table';

/** The overview on its Runs tab: every run across the workspace's automations. */
export const Route = createFileRoute('/_authenticated/automations/runs')({
  component: RunsTable,
});
