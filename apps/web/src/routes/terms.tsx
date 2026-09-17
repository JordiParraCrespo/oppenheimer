import { createFileRoute } from '@tanstack/react-router';
import { TermsScreen } from '@/features/public/screens/terms';

export const Route = createFileRoute('/terms')({ component: TermsPage });

function TermsPage() {
  return <TermsScreen />;
}
