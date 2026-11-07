import { z } from 'zod';
import { defineTool } from './tool';

export const hostTools = [
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
    name: 'list_hosts',
    title: 'List hosts',
    description:
      'List the machines sessions run on: each host’s id and name, whether it is online, its OS and how many sessions it is running. Use a host’s id with start_session.',
    requiredScopes: ['hosts:read'],
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (_args, { client }) => client.get('/hosts'),
  }),

  defineTool({
    name: 'list_projects',
    title: 'List projects',
    description:
      'List projects: each one’s id, name, repositories (owner/name, which one is the default), default host and default agent. A session or an automation works in one of a project’s repositories.',
    requiredScopes: ['projects:read'],
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (_args, { client }) => client.get('/projects'),
  }),
];
