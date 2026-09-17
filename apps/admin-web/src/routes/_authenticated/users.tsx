import { createFileRoute } from '@tanstack/react-router';
import { UsersScreen } from '@/features/admin-users/screens/users';

export const Route = createFileRoute('/_authenticated/users')({ component: UsersScreen });
