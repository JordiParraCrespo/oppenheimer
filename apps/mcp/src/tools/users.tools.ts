import { z } from 'zod';
import { defineTool } from './tool';

const userId = z.string().uuid().describe('The user’s id');

export const userTools = [
  defineTool({
    name: 'whoami',
    title: 'Who am I',
    description:
      'Describe the credential this server is using: which user it acts as, the permissions it was granted, and what those amount to after the user’s roles are applied. Call this first when a tool you expected is missing.',
    requiredScopes: [],
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (_args, { client }) => client.currentCredential(),
  }),

  defineTool({
    name: 'get_my_profile',
    title: 'Get my profile',
    description: 'Read the profile of the user this credential acts on behalf of.',
    requiredScopes: ['profile:read'],
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (_args, { client }) => client.get('/users/me'),
  }),

  defineTool({
    name: 'list_users',
    title: 'List users',
    description:
      'List users in the directory, newest first. Supports pagination and a free-text search over name and email.',
    requiredScopes: ['users:read'],
    inputSchema: z.object({
      page: z.number().int().min(1).optional().describe('1-based page number'),
      limit: z.number().int().min(1).max(100).optional().describe('Page size, max 100'),
      search: z.string().optional().describe('Match against name or email'),
      role: z.string().optional().describe('Filter by role name'),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (args, { client }) => client.get('/users', args),
  }),

  defineTool({
    name: 'get_user',
    title: 'Get a user',
    description: 'Read a single user by id.',
    requiredScopes: ['users:read'],
    inputSchema: z.object({ id: userId }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ id }, { client }) => client.get(`/users/${id}`),
  }),

  defineTool({
    name: 'update_user',
    title: 'Update a user',
    description: 'Update a user’s profile fields. Only the fields you pass are changed.',
    requiredScopes: ['users:write'],
    inputSchema: z.object({
      id: userId,
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
      isActive: z.boolean().optional().describe('Deactivating a user blocks their sign-in'),
    }),
    annotations: { idempotentHint: true },
    handler: ({ id, ...body }, { client }) => client.patch(`/users/${id}`, body),
  }),

  defineTool({
    name: 'delete_user',
    title: 'Delete a user',
    description:
      'Permanently delete a user. This cannot be undone — confirm with the person you are helping before calling it.',
    requiredScopes: ['users:write'],
    inputSchema: z.object({ id: userId }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: async ({ id }, { client }) => {
      await client.delete(`/users/${id}`);
      return { deleted: true, id };
    },
  }),
];
