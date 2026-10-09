import {
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderRow,
} from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * How Settings' Add a host page opens: crumbs back to Hosts, the title, and
 * the line on what pairing exposes. The actions are the pairing's (Cancel,
 * Done), and there are none on a deployment that cannot pair.
 */
export function AddHostHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <PageHeader className="mb-7">
      <PageHeaderCrumbs aria-label={t('common.breadcrumb')}>
        <Link to="/settings/hosts">{t('hosts.add.crumbHosts')}</Link>
        <span>/</span>
        <PageHeaderHere>{t('hosts.add.title')}</PageHeaderHere>
      </PageHeaderCrumbs>
      <PageHeaderRow icon={<Cpu />} title={t('hosts.add.title')} actions={actions} />
      <PageHeaderMeta>
        <span>{t('hosts.add.meta')}</span>
      </PageHeaderMeta>
    </PageHeader>
  );
}
