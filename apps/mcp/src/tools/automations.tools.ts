import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { promptInput } from './sessions.tools';
import { defineTool } from './tool';

const automationId = z.string().uuid().describe('The automation’s id (from list_automations)');

interface ProjectView {
  id: string;
  repositories: {
    installationId: string;
    githubRepoId: string;
    repositoryFullName: string;
    isDefault: boolean;
  }[];
}

export const automationTools = [
  defineTool({
    name: 'list_automations',
    title: 'List automations',
    description:
      'List automations: tasks that start a session on a host on a schedule (or on a GitHub or Gmail event). Each one’s id, name, status (active, paused, running), next run and run count.',
    requiredScopes: ['automations:read'],
    inputSchema: z.object({
      project_id: z.string().uuid().optional().describe('Only this project’s automations'),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: ({ project_id }, { client }) => client.get('/automations', { projectId: project_id }),
  }),

  defineTool({
    name: 'create_automation',
    title: 'Create a scheduled automation',
    description:
      'Create an automation that starts a session on a host on a schedule, with a task, in one of a project’s repositories. frequency is once, hourly, daily, weekdays, weekly or monthly; weekly needs days, monthly day_of_month, once date. It starts active: confirm the schedule with the person first.',
    requiredScopes: ['automations:write', 'projects:read'],
    inputSchema: z.object({
      name: z.string().min(1).max(80).describe('What it is called'),
      task: promptInput('What each run’s agent should do.'),
      project_id: z.string().uuid().describe('The project it works in (from list_projects)'),
      repository: z
        .string()
        .max(200)
        .optional()
        .describe('owner/name of one of the project’s repositories; its default one when omitted'),
      host_id: z.string().uuid().describe('The host each run starts on (from list_hosts)'),
      frequency: z.enum(['once', 'hourly', 'daily', 'weekdays', 'weekly', 'monthly']),
      hour: z
        .number()
        .int()
        .min(0)
        .max(23)
        .describe('Hour of day, 0–23 (hourly reads only minute)'),
      minute: z.number().int().min(0).max(59),
      days: z
        .array(z.number().int().min(0).max(6))
        .min(1)
        .max(7)
        .optional()
        .describe('With weekly: weekdays, 0 = Sunday'),
      day_of_month: z.number().int().min(1).max(31).optional().describe('With monthly'),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('With once: YYYY-MM-DD'),
      timezone: z.string().min(1).max(64).describe('IANA time zone the schedule is read in'),
      agent: z.enum(['claude-code', 'codex', 'opencode', 'grok', 'shell']).optional(),
    }),
    handler: async (args, { client }) => {
      const project = await client.get<ProjectView>(`/projects/${args.project_id}`);
      const wanted = args.repository?.toLowerCase();
      const repository = wanted
        ? project.repositories.find(
            (candidate) => candidate.repositoryFullName.toLowerCase() === wanted,
          )
        : (project.repositories.find((candidate) => candidate.isDefault) ??
          project.repositories[0]);
      if (!repository) {
        throw new Error(
          wanted
            ? `The project has no repository ${args.repository}; list_projects shows its repositories.`
            : 'The project has no repositories to run in.',
        );
      }
      return client.post('/automations', {
        projectId: project.id,
        repositories: [
          {
            installationId: repository.installationId,
            githubRepoId: Number(repository.githubRepoId),
          },
        ],
        place: 'host',
        hostId: args.host_id,
        name: args.name,
        prompt: args.task,
        agent: args.agent ?? 'claude-code',
        triggers: [
          {
            source: 'schedule',
            frequency: args.frequency,
            hour: args.hour,
            minute: args.minute,
            timezone: args.timezone,
            ...(args.frequency === 'weekly' ? { days: args.days } : {}),
            ...(args.frequency === 'monthly' ? { dayOfMonth: args.day_of_month } : {}),
            ...(args.frequency === 'once' ? { date: args.date } : {}),
          },
        ],
      });
    },
  }),

  defineTool({
    name: 'run_automation',
    title: 'Run an automation now',
    description:
      'Start a run of an automation now, outside its schedule. The run is a session like any other.',
    requiredScopes: ['automations:write'],
    inputSchema: z.object({ automation_id: automationId }),
    handler: ({ automation_id }, { client }) =>
      client.post(`/automations/${automation_id}/run`, undefined, {
        'idempotency-key': randomUUID(),
      }),
  }),

  defineTool({
    name: 'pause_automation',
    title: 'Pause an automation',
    description: 'Pause an automation: no run starts until it is resumed.',
    requiredScopes: ['automations:write'],
    inputSchema: z.object({ automation_id: automationId }),
    annotations: { idempotentHint: true },
    handler: ({ automation_id }, { client }) => client.post(`/automations/${automation_id}/pause`),
  }),

  defineTool({
    name: 'resume_automation',
    title: 'Resume an automation',
    description: 'Resume a paused automation.',
    requiredScopes: ['automations:write'],
    inputSchema: z.object({ automation_id: automationId }),
    annotations: { idempotentHint: true },
    handler: ({ automation_id }, { client }) => client.post(`/automations/${automation_id}/resume`),
  }),
];
