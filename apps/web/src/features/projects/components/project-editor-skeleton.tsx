import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Disclosure,
  DisclosureTrigger,
  Field,
  FieldLabel,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Project settings before the project answers, laid out as the editor is:
 * the Name and Repositories fields with their labels written and the
 * controls at their heights, a repository row's place, the folded Defaults
 * with its summary as a bar, and the footer's Delete, Cancel and Save drawn
 * disabled, so the editor lands in the dialog without it changing height.
 */
export function ProjectEditorSkeleton({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <div aria-busy className="flex min-h-0 flex-col">
          <LoadingStatus />
          <DialogHeader>
            <DialogTitle>{t('projects.dialog.editTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-5.5">
              <Field>
                <FieldLabel>{t('projects.dialog.name')}</FieldLabel>
                <Skeleton shape="sm" className="h-(--control-h-md) w-full" />
              </Field>
              <Field>
                <FieldLabel>{t('projects.dialog.repositories')}</FieldLabel>
                <div aria-hidden className="flex flex-col gap-2.5">
                  <Skeleton shape="sm" className="h-(--control-h-md) w-full" />
                  <div className="flex min-h-10 items-center gap-2.5 rounded-md border border-border-subtle pr-1.5 pl-3">
                    <Skeleton shape="sm" className="size-[15px] shrink-0" />
                    <Skeleton shape="sm" className="h-2.5 w-36" />
                  </div>
                </div>
              </Field>
              <Disclosure>
                <DisclosureTrigger
                  disabled
                  meta={t('projects.dialog.optional')}
                  summary={<Skeleton shape="sm" className="inline-block h-2.5 w-28 align-middle" />}
                >
                  {t('projects.dialog.defaults')}
                </DisclosureTrigger>
              </Disclosure>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="destructive-ghost" disabled>
              {t('projects.dialog.delete')}
            </Button>
            <span className="flex-1" />
            <Button type="button" variant="secondary" disabled>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled>
              {t('projects.dialog.save')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
