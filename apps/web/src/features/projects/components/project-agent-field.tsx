import { AgentMark, Chip } from '@oppenheimer/design-system-web';
import { CODING_AGENT_IDS, CODING_AGENTS } from '@oppenheimer/shared/agents';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ProjectFormValues } from '../lib/project-draft';

/** The default agent, in the project dialog's Defaults: a chip per agent, the picked one again to clear it. */
export function ProjectAgentField({ control }: { control: Control<ProjectFormValues> }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'defaultAgent' });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-fg-muted">{t('projects.dialog.agent')}</span>
      <div className="flex flex-wrap gap-1.5">
        {CODING_AGENT_IDS.map((agent) => (
          <Chip
            key={agent}
            selected={field.value === agent}
            icon={<AgentMark agent={agent} />}
            onClick={() => field.onChange(field.value === agent ? null : agent)}
          >
            {CODING_AGENTS[agent].label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
