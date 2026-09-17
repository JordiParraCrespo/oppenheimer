import { createFileRoute } from '@tanstack/react-router';
import { PrivacyScreen } from '@/features/public/screens/privacy';

export const Route = createFileRoute('/privacy')({ component: PrivacyPage });

function PrivacyPage() {
  return <PrivacyScreen />;
}
