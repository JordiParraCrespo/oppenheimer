import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-web';
import { useProfile } from '@oppenheimer/frontend/react';
import { createFileRoute } from '@tanstack/react-router';
import { Trans, useTranslation } from 'react-i18next';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const { data: user } = useProfile();

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.welcome', { name: user?.firstName ?? '' })}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>{t('dashboard.totalUsers')}</CardDescription>
            <CardTitle className="text-2xl">128</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('dashboard.activeSessions')}</CardDescription>
            <CardTitle className="text-2xl">24</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('dashboard.apiCalls')}</CardDescription>
            <CardTitle className="text-2xl">1,420</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('dashboard.uptime')}</CardDescription>
            <CardTitle className="text-2xl">99.9%</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.gettingStarted')}</CardTitle>
          <CardDescription>{t('dashboard.gettingStartedDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <Trans
              i18nKey="dashboard.accountStatus"
              values={{
                role: user?.role ?? '',
                status: user?.isActive ? t('dashboard.active') : t('dashboard.inactive'),
              }}
              components={{ role: <strong />, status: <strong /> }}
            />
          </p>
        </CardContent>
      </Card>
    </>
  );
}
