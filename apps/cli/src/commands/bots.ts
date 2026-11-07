import { Command } from 'commander';
import type { Bot, BotTurn } from '../lib/api-types';
import { contextFor } from '../lib/context';
import { CliError, ExitCode } from '../lib/errors';
import { formatDate, render, style, table } from '../lib/output';
import { resolveBot } from '../lib/resolve';
import { parseDuration, waitForTurn } from '../lib/wait';

/**
 * The console calls bots Employees; in the product they are bots
 * (`product/versions/mvp/25-bots.md`), and so they are here.
 */
export function botsCommand(): Command {
  const bots = new Command('bots')
    .alias('employees')
    .description('Talk to your bots (the Employees section)');

  bots.addCommand(
    new Command('list')
      .alias('ls')
      .description('List your bots')
      .action(async function (this: Command) {
        const context = contextFor(this);
        const list = await context.client.get<Bot[]>('/bots');
        render(context.json, list, () =>
          table(
            list,
            [
              { header: 'ID', value: (bot) => bot.id },
              { header: 'NAME', value: (bot) => bot.name },
              { header: 'JOB', value: (bot) => truncate(bot.description, 50) || '—' },
              { header: 'MODEL', value: (bot) => bot.model ?? bot.provider },
              { header: 'ACTIVE', value: (bot) => formatDate(bot.lastActivityAt) },
            ],
            'No bots yet. Create one in the console (Employees).',
          ),
        );
      }),
  );

  bots.addCommand(
    new Command('chat')
      .alias('ask')
      .description('Send a bot a message and print its answer')
      .argument('<bot>', 'Bot name or id')
      .argument('<message...>', 'What to say')
      .option('--no-wait', 'Send it and return; read the answer in the console')
      .option('--timeout <duration>', 'How long to wait for the answer', '10m')
      .action(async function (this: Command, needle: string, words: string[]) {
        const options = this.opts<{ wait: boolean; timeout: string }>();
        const context = contextFor(this);
        const bot = await resolveBot(context.client, needle);
        const turn = await context.client.post<BotTurn>(`/bots/${bot.id}/messages`, {
          body: {
            content: words.join(' '),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });

        if (!options.wait) {
          render(context.json, turn, () => `${style.green('✓')} Sent to ${bot.name}.`);
          return;
        }

        let timeoutMs: number;
        try {
          timeoutMs = parseDuration(options.timeout);
        } catch (error) {
          throw new CliError((error as Error).message, ExitCode.USAGE);
        }
        const outcome = await waitForTurn(context.client, bot.id, turn.id, {
          timeoutMs,
          intervalMs: 2_000,
        });

        render(context.json, outcome, () => {
          const lines = outcome.replies.map((reply) => reply.content.trim());
          for (const approval of outcome.pending) {
            lines.push(
              `${style.yellow('!')} ${bot.name} waits on your approval: ${approval.summary} ${style.dim('(decide it in the console)')}`,
            );
          }
          if (outcome.turn?.status === 'failed') {
            lines.push(`${style.red('✗')} ${outcome.turn.error ?? 'The turn failed.'}`);
          }
          return lines.join('\n\n') || style.dim(`${bot.name} has not answered yet.`);
        });

        if (outcome.timedOut) {
          throw new CliError(
            `${bot.name} is still working after ${options.timeout}.`,
            ExitCode.FAILURE,
            'It keeps going; read the answer in the console.',
          );
        }
        if (outcome.turn?.status === 'failed') {
          throw new CliError(`${bot.name}'s turn failed.`, ExitCode.FAILURE);
        }
      }),
  );

  return bots;
}

function truncate(text: string, length: number): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > length ? `${line.slice(0, length - 1)}…` : line;
}
