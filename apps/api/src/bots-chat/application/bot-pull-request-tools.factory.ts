import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { MERGE_METHODS, REVIEW_COMMENT_MAX } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { AddIssueCommentCommand } from '../../github/commands/add-issue-comment/add-issue-comment.command';
import { FindHostQuery } from '../../hosts/queries/find-host/find-host.query';
import { AddPullRequestCommentCommand } from '../../pull-requests/commands/add-pull-request-comment/add-pull-request-comment.command';
import { MergePullRequestCommand } from '../../pull-requests/commands/merge-pull-request/merge-pull-request.command';
import { StartReviewSessionCommand } from '../../pull-requests/commands/start-review-session/start-review-session.command';
import { SubmitPullRequestReviewCommand } from '../../pull-requests/commands/submit-pull-request-review/submit-pull-request-review.command';
import { FindPullRequestQuery } from '../../pull-requests/queries/find-pull-request/find-pull-request.query';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import { describeTarget, type PullRequestDetailView } from '../bot-github-tool.mapper';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import { cut } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/** The three ids every pull request tool takes, as list_pull_requests gives them. */
const address = {
  installation_id: z.uuid().describe('The installation id from list_pull_requests.'),
  github_repo_id: z
    .number()
    .int()
    .positive()
    .describe('The repository id from list_pull_requests or list_repositories.'),
  number: z.number().int().positive().describe('The pull request number.'),
};

const lineComment = z.object({
  path: z.string().min(1).max(4096).describe('The file, as get_pull_request lists it.'),
  line: z.number().int().positive().describe('The line in the diff.'),
  side: z
    .enum(['LEFT', 'RIGHT'])
    .default('RIGHT')
    .describe('RIGHT (default) is the new file, LEFT the old.'),
  body: z.string().trim().min(1).max(REVIEW_COMMENT_MAX),
});

type Address = { installation_id: string; github_repo_id: number; number: number };

/**
 * GitHub and pull requests, the writes (`25-bots.md` §4.4): comment, review,
 * merge, and start a review session. Each reaches outside Oppenheimer, so
 * under Approve for me each asks first and its card names the pull request
 * by repository, number and title. Every write is made with the owner's own
 * GitHub user token through the pull-requests module's commands, so GitHub
 * records the person, and GitHub's branch rules stay the gate: nothing is
 * bypassed or forced. A merge is pinned to the head the card showed.
 */
@Injectable()
export class BotPullRequestToolsFactory implements BotToolArea {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.commentOnPullRequest(),
      this.reviewPullRequest(),
      this.mergePullRequest(),
      this.startReviewSession(),
    ];
  }

  private commentOnPullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'comment_on_pull_request',
      scope: 'pulls:write',
      asks: true,
      description:
        "Posts a comment on a pull request in the person's name: on its conversation, or on one line of its diff when path and line are given. Use review_pull_request to approve or ask for changes instead.",
      input: z
        .object({
          ...address,
          body: z
            .string()
            .trim()
            .min(1)
            .max(REVIEW_COMMENT_MAX)
            .describe('The comment (Markdown).'),
          path: z
            .string()
            .min(1)
            .max(4096)
            .optional()
            .describe('Only for a line comment: the file, as get_pull_request lists it.'),
          line: z.number().int().positive().optional().describe('With path: the line in the diff.'),
          side: z
            .enum(['LEFT', 'RIGHT'])
            .default('RIGHT')
            .describe('With path: RIGHT is the new file.'),
        })
        // In the schema, so a half line comment is refused in either mode and
        // never posted on the conversation instead.
        .refine((value) => (value.path === undefined) === (value.line === undefined), {
          path: ['line'],
          message:
            'A line comment needs both path and line; leave both out to comment on the conversation.',
        }),
      summarize: async (input, context) => {
        const where = input.path ? ` on ${input.path}:${input.line}` : '';
        return `Comment on ${await this.target(context, input)}${where}: "${cut(input.body, 120)}"`;
      },
      run: async (input, context) => {
        const target = addressOf(input);
        if (input.path !== undefined && input.line !== undefined) {
          await this.commandBus.execute(
            new AddPullRequestCommentCommand({
              scope: context.owner,
              address: target,
              comment: { path: input.path, line: input.line, side: input.side, body: input.body },
            }),
          );
          return `Commented on ${input.path}:${input.line} of pull request #${input.number}.`;
        }
        const posted = await this.commandBus.execute<AddIssueCommentCommand, { htmlUrl: string }>(
          new AddIssueCommentCommand({ scope: context.owner, address: target, body: input.body }),
        );
        return `Commented on pull request #${input.number}: ${posted.htmlUrl}`;
      },
    });
  }

  private reviewPullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'review_pull_request',
      scope: 'pulls:write',
      asks: true,
      description:
        "Submits a review in the person's name: approve, request changes, or comment, with an optional summary and up to 50 line comments. Approving does not merge; use merge_pull_request for that. Requesting changes or commenting needs a body or a line comment.",
      input: z
        .object({
          ...address,
          verdict: z.enum(['approve', 'request_changes', 'comment']),
          body: z.string().trim().max(REVIEW_COMMENT_MAX).optional().describe('The summary.'),
          comments: z.array(lineComment).max(50).default([]),
        })
        .refine(
          (value) =>
            value.verdict === 'approve' || Boolean(value.body) || value.comments.length > 0,
          {
            path: ['body'],
            message: 'Requesting changes or commenting needs a body or a line comment.',
          },
        ),
      summarize: async (input, context) => {
        const verdict = {
          approve: 'Approve',
          request_changes: 'Request changes on',
          comment: 'Review',
        }[input.verdict];
        const notes = input.comments.length ? ` with ${input.comments.length} line comments` : '';
        const said = input.body ? `: "${cut(input.body, 120)}"` : '';
        return `${verdict} ${await this.target(context, input)}${notes}${said}`;
      },
      run: async (input, context) => {
        await this.commandBus.execute(
          new SubmitPullRequestReviewCommand({
            scope: context.owner,
            address: addressOf(input),
            review: { verdict: input.verdict, body: input.body, comments: input.comments },
          }),
        );
        return `Submitted the review (${input.verdict}) on pull request #${input.number}.`;
      },
    });
  }

  private mergePullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'merge_pull_request',
      scope: 'pulls:write',
      asks: true,
      description:
        "Merges an open pull request in the person's name, squash by default, at the head commit get_pull_request showed: if anything was pushed since, nothing merges and you should read it again. GitHub's branch rules decide; when they hold it (checks, a required review, a conflict), the answer says so and nothing is forced.",
      input: z.object({
        ...address,
        method: z.enum(MERGE_METHODS).default('squash'),
        head_sha: z
          .string()
          .regex(/^[0-9a-f]{7,40}$/)
          .optional()
          .describe('The head commit get_pull_request showed; the current one when omitted.'),
      }),
      // The card is pinned to the head it was raised on, so a yes merges what the card showed.
      normalize: async (input, context) => {
        const pull = await this.pull(context, input);
        if (pull.state !== 'open') {
          throw new BotToolRefusal(
            `Pull request #${input.number} is ${pull.state}; there is nothing to merge.`,
          );
        }
        if (input.head_sha && !pull.headSha.startsWith(input.head_sha)) {
          throw new BotToolRefusal(
            `New commits were pushed to #${input.number} since you read it (head is now ${pull.headSha.slice(0, 7)}). Read it again with get_pull_request before merging.`,
          );
        }
        return { ...input, head_sha: pull.headSha };
      },
      summarize: async (input, context) => {
        const head = input.head_sha ? `, at ${input.head_sha.slice(0, 7)}` : '';
        return `Merge ${await this.target(context, input)} (${input.method}${head})`;
      },
      run: async (input, context) => {
        await this.commandBus.execute(
          new MergePullRequestCommand({
            scope: context.owner,
            address: addressOf(input),
            method: input.method,
            expectedHeadSha: await this.fullHead(context, input.head_sha, input),
          }),
        );
        return `Merged pull request #${input.number} (${input.method}).`;
      },
    });
  }

  private startReviewSession(): BotToolDefinition {
    return defineBotTool({
      name: 'start_review_session',
      scope: 'sessions:write',
      asks: true,
      description:
        "Starts a review session for a pull request: a worktree of its head branch on a host, with Claude Code reviewing it. It returns at once with the session's id; read it later with get_session. The host defaults to your home host. A pull request from a fork cannot be reviewed this way.",
      input: z.object({
        ...address,
        host_id: z.uuid().optional().describe('The host to run on (from list_hosts).'),
      }),
      normalize: (input, context) => {
        const hostId = input.host_id ?? context.homeHostId;
        if (!hostId) {
          throw new BotToolRefusal(
            'You have no home host; ask the person which host (list_hosts) to review on.',
          );
        }
        return { ...input, host_id: hostId };
      },
      summarize: async (input, context) => {
        const host = input.host_id ? await this.hostName(context, input.host_id) : 'your home host';
        return `Start a review session for ${await this.target(context, input)} on ${host}`;
      },
      run: async (input, context) => {
        const hostId = input.host_id ?? context.homeHostId;
        if (!hostId) {
          throw new BotToolRefusal(
            'You have no home host; ask the person which host (list_hosts) to review on.',
          );
        }
        const result = await this.commandBus.execute<
          StartReviewSessionCommand,
          SessionCommandResult
        >(
          new StartReviewSessionCommand({
            scope: context.owner,
            userId: context.owner.userId,
            address: addressOf(input),
            hostId,
            idempotencyKey: idempotencyKeyOf(context.turnId, input, context.approvalId),
          }),
        );
        const offline = result.hints.includes('host_offline')
          ? ' The host is offline: the session is queued and starts when it comes back.'
          : '';
        return {
          content: `Started review session ${result.sessionId} for pull request #${input.number} on host ${hostId}.${offline} Read it later with get_session.`,
          sessionId: result.sessionId,
        };
      },
    });
  }

  private pull(context: BotToolCallContext, input: Address): Promise<PullRequestDetailView> {
    return this.queryBus.execute<FindPullRequestQuery, PullRequestDetailView>(
      new FindPullRequestQuery({ scope: context.owner, address: addressOf(input) }),
    );
  }

  /**
   * The head a merge is pinned to, written out in full: a card's is already
   * (`normalize`); a short one the model passed under Full access is read
   * against the pull request, and one that no longer matches stays short, so
   * the merge is refused.
   */
  private async fullHead(
    context: BotToolCallContext,
    head: string | undefined,
    input: Address,
  ): Promise<string | undefined> {
    if (!head || head.length === 40) return head;
    const pull = await this.pull(context, input);
    return pull.headSha.startsWith(head) ? pull.headSha : head;
  }

  /** The pull request as a card names it; by number alone when it cannot be read. */
  private async target(context: BotToolCallContext, input: Address): Promise<string> {
    const pull = await this.pull(context, input).catch(() => null);
    return pull
      ? describeTarget(pull.repository, pull.number, pull.title)
      : `pull request #${input.number} (repo ${input.github_repo_id})`;
  }

  /** The host's name as the owner sees it; its id when they cannot read it. */
  private async hostName(context: BotToolCallContext, hostId: string): Promise<string> {
    const overview = await this.queryBus
      .execute<FindHostQuery, { host: { name: string } }>(
        new FindHostQuery({ scope: context.owner, hostId }),
      )
      .catch(() => null);
    return overview?.host.name ?? `host ${hostId}`;
  }
}

function addressOf(input: Address) {
  return {
    installationId: input.installation_id,
    githubRepoId: input.github_repo_id,
    number: input.number,
  };
}
