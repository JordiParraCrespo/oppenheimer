import { Chip, FieldDescription, Skeleton } from '@oppenheimer/design-system-web';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ProjectFormValues } from '../lib/project-draft';

/** The default host, in the project dialog's Defaults: a chip per host, the picked one again to clear it. */
export function ProjectHostField({ control }: { control: Control<ProjectFormValues> }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'defaultHostId' });
  const hosts = useHosts({
    select: (rows) => rows.map((host) => ({ id: host.id, name: host.name })),
  });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12.5px] text-fg-muted">{t('projects.dialog.host')}</span>
      <div className="flex flex-wrap gap-1.5">
        {hosts.isPending ? (
          <Skeleton className="h-7 w-24" />
        ) : hosts.data?.length ? (
          hosts.data.map((host) => (
            <Chip
              key={host.id}
              selected={field.value === host.id}
              onClick={() => field.onChange(field.value === host.id ? null : host.id)}
            >
              {host.name}
            </Chip>
          ))
        ) : (
          <FieldDescription>{t('projects.dialog.noHost')}</FieldDescription>
        )}
      </div>
    </div>
  );
}
