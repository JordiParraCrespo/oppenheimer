import { z } from 'zod';
import { defineTool } from './tool';

const workspaceId = z.string().uuid().describe('The workspace’s id');

export const workspaceTools = [
  defineTool({
    name: 'list_workspaces',
    title: 'List workspaces',
    description:
      'List the workspaces of an organization. Defaults to the credential’s active organization when none is given.',
    requiredScopes: ['workspaces:read'],
    inputSchema: z.object({
      organizationId: z.string().uuid().optional(),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (args, { client }) => client.get('/workspaces', args),
  }),

  defineTool({
    name: 'create_workspace',
    title: 'Create a workspace',
    description: 'Create a workspace inside an organization.',
    requiredScopes: ['workspaces:write'],
    inputSchema: z.object({
      name: z.string().min(1).max(100),
      organizationId: z.string().uuid().optional(),
    }),
    handler: (args, { client }) => client.post('/workspaces', args),
  }),

  defineTool({
    name: 'rename_workspace',
    title: 'Rename a workspace',
    description: 'Change a workspace’s name.',
    requiredScopes: ['workspaces:write'],
    inputSchema: z.object({ id: workspaceId, name: z.string().min(1).max(100) }),
    annotations: { idempotentHint: true },
    handler: ({ id, name }, { client }) => client.patch(`/workspaces/${id}`, { name }),
  }),

  defineTool({
    name: 'delete_workspace',
    title: 'Delete a workspace',
    description: 'Delete a workspace. This cannot be undone.',
    requiredScopes: ['workspaces:write'],
    inputSchema: z.object({ id: workspaceId }),
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: async ({ id }, { client }) => {
      await client.delete(`/workspaces/${id}`);
      return { deleted: true, id };
    },
  }),

  defineTool({
    name: 'list_workspace_members',
    title: 'List workspace members',
    description: 'List the users belonging to a workspace.',
    requiredScopes: ['workspaces:read'],
    inputSchema: z.object({ id: workspaceId }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ id }, { client }) => client.get(`/workspaces/${id}/members`),
  }),

  defineTool({
    name: 'add_workspace_member',
    title: 'Add a user to a workspace',
    description: 'Add a user to a workspace. They must already be a member of the organization.',
    requiredScopes: ['workspaces:write'],
    inputSchema: z.object({ id: workspaceId, userId: z.string().uuid() }),
    annotations: { idempotentHint: true },
    handler: ({ id, userId }, { client }) => client.post(`/workspaces/${id}/members`, { userId }),
  }),

  defineTool({
    name: 'remove_workspace_member',
    title: 'Remove a user from a workspace',
    description: 'Remove a user from a workspace. They keep their organization membership.',
    requiredScopes: ['workspaces:write'],
    inputSchema: z.object({ id: workspaceId, userId: z.string().uuid() }),
    annotations: { idempotentHint: true },
    handler: async ({ id, userId }, { client }) => {
      await client.delete(`/workspaces/${id}/members/${userId}`);
      return { removed: true, workspaceId: id, userId };
    },
  }),
];
