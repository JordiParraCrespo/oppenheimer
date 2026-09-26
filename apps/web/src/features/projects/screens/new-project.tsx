import { PageHeaderHere } from '@oppenheimer/design-system-web';
import { ChevronLeft } from '@oppenheimer/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NewProject } from '../sections/new-project';

/**
 * New project: a page in the console's main pane, the export's `.op-rpage` —
 * a Back link, then the header and the steps in a 760px column over 32px of
 * gutter. It is reached from New session's project chip, so Back and the
 * breadcrumb both lead there.
 *
 * The screen composes; the section below reads the lists and saves.
 */
export function NewProjectScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-190 flex-col px-8 pt-6 pb-18 motion-safe:animate-label-in">
        <Link
          to="/sessions/new"
          className="-ml-2 mb-4.5 inline-flex h-7 items-center gap-0.5 self-start rounded-pill pr-2.5 pl-1 text-sm text-fg-muted no-underline transition-colors hover:bg-hover-surface hover:text-fg"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t('projects.new.back')}
        </Link>
        <NewProject
          crumbs={
            <>
              <Link to="/sessions/new">{t('sessions.new.title')}</Link>
              <span aria-hidden>/</span>
              <PageHeaderHere>{t('projects.new.title')}</PageHeaderHere>
            </>
          }
        />
      </div>
    </div>
  );
}
