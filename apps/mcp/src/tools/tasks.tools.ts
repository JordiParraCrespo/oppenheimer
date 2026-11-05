import { TASK_NOTES_MAX, TASK_STATUSES, TASK_TITLE_MAX } from '@oppenheimer/shared';
import { z } from 'zod';
import { defineTool } from './tool';

export const taskTools = [
  defineTool({
    name: 'list_tasks',
    title: 'List tasks',
    description:
      'List the Plan board’s tasks: id, title, status (todo, doing, review, done), project and due date.',
    requiredScopes: ['tasks:read'],
    inputSchema: z.object({
      project_id: z.string().uuid().optional().describe('Only this project’s tasks'),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ project_id }, { client }) => client.get('/tasks', { projectId: project_id }),
  }),

  defineTool({
    name: 'create_task',
    title: 'Create a task',
    description: 'Add a task to the Plan board.',
    requiredScopes: ['tasks:write'],
    inputSchema: z.object({
      title: z.string().trim().min(1).max(TASK_TITLE_MAX),
      notes: z.string().max(TASK_NOTES_MAX).optional(),
      status: z.enum(TASK_STATUSES).optional(),
      project_id: z.string().uuid().optional(),
      due_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
    handler: (args, { client }) =>
      client.post('/tasks', {
        title: args.title,
        notes: args.notes,
        status: args.status,
        projectId: args.project_id,
        dueDate: args.due_date,
      }),
  }),

  defineTool({
    name: 'move_task',
    title: 'Move a task',
    description:
      'Move a task to another column of the board (todo, doing, review, done), at its top.',
    requiredScopes: ['tasks:write'],
    inputSchema: z.object({
      task_id: z.string().uuid(),
      status: z.enum(TASK_STATUSES),
    }),
    annotations: { idempotentHint: true },
    handler: ({ task_id, status }, { client }) =>
      client.post(`/tasks/${task_id}/move`, { status, afterTaskId: null }),
  }),
];
