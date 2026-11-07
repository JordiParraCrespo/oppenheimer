import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  HOST_EXEC_DEFAULT_TIMEOUT_SECONDS,
  HOST_EXEC_MAX_ARG_LENGTH,
  HOST_EXEC_MAX_ARGS,
} from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import { FindHostQuery } from '../../hosts/queries/find-host/find-host.query';
import type { HostExecOutcome } from '../../sessions/application/host-exec.port';
import { RunHostCommandCommand } from '../../sessions/commands/run-host-command/run-host-command.command';
import { describeHostCommand, hostCommandSummary } from './bot-host-command.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/**
 * The longest one `run_command` may take, in seconds: well inside a turn's
 * four minutes, so the answer comes back to the turn that asked. Longer work
 * is a session.
 */
export const RUN_COMMAND_MAX_TIMEOUT_SECONDS = 120;

/**
 * Commands on a host (`25-bots.md` §4.2, "Commands on a host"): one program,
 * run on one of the owner's hosts by its runner, its output read back in the
 * same turn. It reaches outside Oppenheimer, so under Approve for me it asks
 * first; and whatever the bot's permissions say, the host runs only what its
 * own policy (`runner exec`) allows, which is off until the person on the
 * host turns it on.
 */
@Injectable()
export class BotHostCommandToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.runCommand()];
  }

  private runCommand(): BotToolDefinition {
    return defineBotTool({
      name: 'run_command',
      scope: 'sessions:write',
      asks: true,
      description: `Runs one program on one of the person's hosts and returns its exit code, stdout and stderr, for a quick command or a script: \`python3 report.py\`, \`node build.js\`, \`git status\`, \`ls -la\`. argv is the program and its arguments, run directly with no shell, so pipes, \`&&\`, redirects and \`$VAR\` are plain text unless the program is a shell (\`bash -c "…"\`), which the host must allow like any other. It starts in your own folder on that host, kept between calls, unless cwd names another; stdin is empty, so write a script there with one call (\`python3 -c\` code that writes the file) and run it with the next. The host decides what may run: by default nothing, and otherwise only the programs its owner allowed with \`runner exec\` on the host itself; a refusal says how to allow it, and you pass that on rather than trying another program. Each call lasts at most ${RUN_COMMAND_MAX_TIMEOUT_SECONDS} s; longer work, or changing code in a repository, is a session (start_session). Output keeps the last 32 KB of each stream. The host defaults to your home host.`,
      input: z.object({
        argv: z
          .array(z.string().min(1).max(HOST_EXEC_MAX_ARG_LENGTH))
          .min(1)
          .max(HOST_EXEC_MAX_ARGS)
          .describe(
            'The program, then its arguments, each one element: ["python3", "report.py", "--since", "7d"].',
          ),
        host_id: z
          .uuid()
          .optional()
          .describe('The host to run on (from list_hosts); your home host when omitted.'),
        cwd: z
          .string()
          .regex(/^\/[^\0]*$/)
          .max(1_024)
          .optional()
          .describe(
            'An absolute folder on the host to run in; your own folder there when omitted.',
          ),
        timeout_seconds: z
          .number()
          .int()
          .min(1)
          .max(RUN_COMMAND_MAX_TIMEOUT_SECONDS)
          .optional()
          .describe(
            `How long it may run before it is stopped; ${HOST_EXEC_DEFAULT_TIMEOUT_SECONDS} when omitted.`,
          ),
      }),
      normalize: (input, context) => ({ ...input, host_id: hostOf(input, context) }),
      subject: async (input, context) => {
        const hostId = hostOf(input, context);
        const program = input.argv[0] ?? '';
        // Hashed, so a standing yes is for this program alone: a grant's key
        // is cut to fit its column, and a cut path would match any program
        // that shares its start.
        return {
          kind: 'host_program',
          key: `${hostId}:${createHash('sha256').update(program).digest('hex')}`,
          label: `${program} on ${await this.hostName(context, hostId)}`,
        };
      },
      summarize: async (input, context) => {
        const host = await this.hostName(context, hostOf(input, context));
        return hostCommandSummary(input.argv, host, input.cwd);
      },
      run: async (input, context) => {
        const hostId = hostOf(input, context);
        const outcome = await this.commandBus.execute<RunHostCommandCommand, HostExecOutcome>(
          new RunHostCommandCommand({
            scope: context.owner,
            hostId,
            request: {
              argv: input.argv,
              ...(input.cwd ? { cwd: input.cwd } : {}),
              home: context.botId.toLowerCase(),
              timeoutSeconds: input.timeout_seconds ?? HOST_EXEC_DEFAULT_TIMEOUT_SECONDS,
            },
          }),
        );
        return describeHostCommand(outcome, await this.hostName(context, hostId));
      },
    });
  }

  private async hostName(context: BotToolCallContext, hostId: string): Promise<string> {
    const overview = await this.queryBus
      .execute<FindHostQuery, { host: { name: string } }>(
        new FindHostQuery({ scope: context.owner, hostId }),
      )
      .catch(() => null);
    return overview?.host.name ?? `host ${hostId}`;
  }
}

/**
 * The host a call runs on: the one it names, else the bot's home host. One
 * decision for every hook of the call, refused in words when there is none.
 */
function hostOf(input: { host_id?: string }, context: BotToolCallContext): string {
  const hostId = input.host_id ?? context.homeHostId;
  if (!hostId) {
    throw new BotToolRefusal(
      'No host named and you have no home host: ask which host to use, and say they can set one in Settings → Home host.',
    );
  }
  return hostId;
}
