import { createFileRoute } from '@tanstack/react-router';
import { AboutScreen } from '@/features/public/screens/about';

export const Route = createFileRoute('/about')({ component: PublicAboutPage });

function PublicAboutPage() {
  return <AboutScreen />;
}
