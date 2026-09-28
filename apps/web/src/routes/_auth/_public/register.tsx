import { createFileRoute } from '@tanstack/react-router';
import { registerSearchSchema } from '@/features/auth/lib/search';
import { RegisterScreen } from '@/features/auth/screens/register';

export const Route = createFileRoute('/_auth/_public/register')({
  validateSearch: registerSearchSchema,
  component: RegisterPage,
});

function RegisterPage() {
  const { error } = Route.useSearch();

  return <RegisterScreen oauthError={error} />;
}
