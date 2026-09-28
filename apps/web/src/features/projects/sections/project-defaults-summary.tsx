import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ProjectFormValues } from '../lib/project-draft';

/**
 * What the closed Defaults fold reads: the default host's name, the default
 * agent, how many repositories are cloned by default. The one component that
 * shows these three together is the one that watches them.
 */
export function ProjectDefaultsSummary({ control }: { control: Control<ProjectFormValues> }) {
  const { t } = useTranslation();
  const [rows, defaultHostId, defaultAgent] = useWatch({
    control,
    name: ['rows', 'defaultHostId', 'defaultAgent'],
  });
  const { data: hostName } = useHosts({
    select: (hosts) => hosts.find((host) => host.id === defaultHostId)?.name,
  });
  const cloned = rows.filter((row) => row.isDefault).length;

  return [
    hostName,
    defaultAgent ? CODING_AGENTS[defaultAgent].label : undefined,
    rows.length ? t('projects.dialog.clonedCount', { count: cloned }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}
