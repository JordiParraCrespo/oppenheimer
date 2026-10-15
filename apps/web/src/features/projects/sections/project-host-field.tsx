import { Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ProjectFormValues } from '../lib/project-draft';
import { ProjectHostChips } from './project-host-chips';

/**
 * The default host, in the project dialog's Defaults: a chip per host, the
 * picked one again to clear it. The chips read the hosts under Suspense.
 */
export function ProjectHostField({ control }: { control: Control<ProjectFormValues> }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'defaultHostId' });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-fg-muted">{t('projects.dialog.host')}</span>
      <div className="flex flex-wrap gap-1.5">
        <QueryState>
          <QueryState.Pending>
            <Skeleton className="h-(--control-h-md) w-24" />
          </QueryState.Pending>
          <QueryState.Error fallback={t('sessions.new.host.failed')} />
          <QueryState.Data>
            <ProjectHostChips value={field.value} onChange={field.onChange} />
          </QueryState.Data>
        </QueryState>
      </div>
    </div>
  );
}
