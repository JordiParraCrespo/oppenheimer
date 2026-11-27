import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CI_FINDING_ACTIONS,
  CI_FINDING_CHECK_MAX,
  CI_FINDING_CONFIDENCE,
  CI_FINDING_EVIDENCE_ITEM_MAX,
  CI_FINDING_EVIDENCE_MAX,
  CI_FINDING_FLAKE,
  CI_FINDING_NEXT_MAX,
  CI_FINDING_RELATIONS,
  CI_FINDING_ROOT_CAUSE_MAX,
  CI_FINDINGS_PER_RECORD_MAX,
  MERGE_METHODS,
  REVIEW_COMMENT_MAX,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { FindHostQuery } from '../../hosts/queries/find-host/find-host.query';
import { AddPullRequestCommentCommand } from '../../pull-requests/commands/add-pull-request-comment/add-pull-request-comment.command';
import { AddPullRequestConversationCommentCommand } from '../../pull-requests/commands/add-pull-request-conversation-comment/add-pull-request-conversation-comment.command';
import { MergePullRequestCommand } from '../../pull-requests/commands/merge-pull-request/merge-pull-request.command';
import {
  type CiFindingInput,
  RecordCiFindingsCommand,
} from '../../pull-requests/commands/record-ci-findings/record-ci-findings.command';
import { StartReviewSessionCommand } from '../../pull-requests/commands/start-review-session/start-review-session.command';
import { SubmitPullRequestReviewCommand } from '../../pull-requests/commands/submit-pull-request-review/submit-pull-request-review.command';
import { FindPullRequestQuery } from '../../pull-requests/queries/find-pull-request/find-pull-request.query';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import { describeTarget, type PullRequestDetailView } from '../bot-github-tool.mapper';
import { NOT_ON_A_GITHUB_ASK } from '../domain/bot-github-ask.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import type { BotToolSubject } from '../domain/bot-tool-permission.entity';
import { cut } from '../domain/bot-tool-text.policy';
import { BotSessionWatchResolver } from './bot-session-watch.resolver';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
  repositorySubject,
} from './bot-tool.factory';

/** The three ids every pull request tool takes, as list_pull_requests gives them. */
const address = {
  installation_id: z
    .uuid()
    .describe(promptText('github/tools-pull-request.address-installation-id')),
  github_repo_id: z
    .number()
    .int()
    .positive()
    .describe(promptText('github/tools-pull-request.address-github-repo-id')),
  number: z.number().int().positive().describe('The pull request number.'),
};

const lineComment = z.object({
  path: z
    .string()
    .min(1)
    .max(4096)
    .describe(promptText('github/tools-pull-request.line-comment-path')),
  line: z.number().int().positive().describe('The line in the diff.'),
  side: z
    .enum(['LEFT', 'RIGHT'])
    .default('RIGHT')
    .describe(promptText('github/tools-pull-request.line-comment-side')),
  body: z.string().trim().min(1).max(REVIEW_COMMENT_MAX),
});

type Address = { installation_id: string; github_repo_id: number; number: number };

/** What one failing check came to, as `record_ci_findings` takes it. */
const ciFinding = z.object({
  check: z
    .string()
    .trim()
    .min(1)
    .max(CI_FINDING_CHECK_MAX)
    .describe(promptText('github/tools-pull-request.ci-finding-check')),
  root_cause: z
    .string()
    .trim()
    .min(1)
    .max(CI_FINDING_ROOT_CAUSE_MAX)
    .describe(promptText('github/tools-pull-request.ci-finding-root-cause')),
  relation: z
    .enum(CI_FINDING_RELATIONS)
    .describe(promptText('github/tools-pull-request.ci-finding-relation')),
  flake: z
    .enum(CI_FINDING_FLAKE)
    .describe(promptText('github/tools-pull-request.ci-finding-flake')),
  action: z
    .enum(CI_FINDING_ACTIONS)
    .describe(promptText('github/tools-pull-request.ci-finding-action')),
  next: z
    .string()
    .trim()
    .min(1)
    .max(CI_FINDING_NEXT_MAX)
    .describe(promptText('github/tools-pull-request.ci-finding-next')),
  confidence: z.enum(CI_FINDING_CONFIDENCE),
  evidence: z
    .array(z.string().trim().min(1).max(CI_FINDING_EVIDENCE_ITEM_MAX))
    .min(1)
    .max(CI_FINDING_EVIDENCE_MAX)
    .describe(promptText('github/tools-pull-request.ci-finding-evidence')),
});

/**
 * A finding as the model wrote it, as the command takes it: the one field
 * whose name differs is renamed, and every other passes through, so a field
 * added to the schema reaches the command without another line here.
 */
function toCiFinding({ root_cause, ...rest }: z.output<typeof ciFinding>): CiFindingInput {
  return { ...rest, rootCause: root_cause };
}

/**
 * GitHub and pull requests, the writes: comment, review,
 * merge, and start a review session. Each reaches outside Oppenheimer, so
 * under Auto each asks first and its card names the pull request
 * by repository, number and title. Every write is made with the owner's own
 * GitHub user token through the pull-requests module's commands, so GitHub
 * records the person, and GitHub's branch rules stay the gate: nothing is
 * bypassed or forced. A merge is pinned to the head the card showed.
 */
@Injectable()
export class BotPullRequestToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'github' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly watches: BotSessionWatchResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.commentOnPullRequest(),
      this.reviewPullRequest(),
      this.mergePullRequest(),
      this.startReviewSession(),
      this.recordCiFindings(),
    ];
  }

  /**
   * What the failing checks came to: a record on the pull request's head, shown
   * with its checks, rather than prose in a chat. It writes nothing to GitHub,
   * so it does not ask.
   */
  private recordCiFindings(): BotToolDefinition {
    return defineBotTool({
      name: 'record_ci_findings',
      scope: 'pulls:write',
      description: promptText('github/tools-pull-request.record-ci-findings', {
        ciFindingsPerRecordMax: String(CI_FINDINGS_PER_RECORD_MAX),
      }),
      input: z.strictObject({
        ...address,
        findings: z.array(ciFinding).min(1).max(CI_FINDINGS_PER_RECORD_MAX),
      }),
      run: async (input, context) => {
        const headSha = await this.commandBus.execute<RecordCiFindingsCommand, string>(
          new RecordCiFindingsCommand({
            scope: context.owner,
            address: addressOf(input),
            findings: input.findings.map(toCiFinding),
            botId: context.botId,
          }),
        );
        const checks = input.findings.map((finding) => finding.check).join(', ');
        return promptText('github/tools-pull-request.record-ci-findings-done', {
          findingsCount: String(input.findings.length),
          suffix: input.findings.length === 1 ? '' : 's',
          number: String(input.number),
          headSha: headSha.slice(0, 7),
          checks,
        });
      },
    });
  }

  private commentOnPullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'comment_on_pull_request',
      scope: 'pulls:write',
      notOn: NOT_ON_A_GITHUB_ASK,
      asks: true,
      sharesOutside: true,
      subject: (input, context) => this.repositorySubject(context, input),
      description: promptText('github/tools-pull-request.comment-on-pull-request'),
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
            .describe(promptText('github/tools-pull-request.comment-on-pull-request-path')),
          line: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(promptText('github/tools-pull-request.comment-on-pull-request-line')),
          side: z
            .enum(['LEFT', 'RIGHT'])
            .default('RIGHT')
            .describe(promptText('github/tools-pull-request.comment-on-pull-request-side')),
        })
        // In the schema, so a half line comment is refused in either mode and
        // never posted on the conversation instead.
        .refine((value) => (value.path === undefined) === (value.line === undefined), {
          path: ['line'],
          message: promptText('github/tools-pull-request.comment-on-pull-request-message'),
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
          return promptText('github/tools-pull-request.comment-on-line-done', {
            path: input.path,
            line: String(input.line),
            number: String(input.number),
          });
        }
        const posted = await this.commandBus.execute<
          AddPullRequestConversationCommentCommand,
          { htmlUrl: string }
        >(
          new AddPullRequestConversationCommentCommand({
            scope: context.owner,
            address: target,
            body: input.body,
          }),
        );
        return promptText('github/tools-pull-request.comment-done', {
          number: String(input.number),
          htmlUrl: posted.htmlUrl,
        });
      },
    });
  }

  private reviewPullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'review_pull_request',
      scope: 'pulls:write',
      notOn: NOT_ON_A_GITHUB_ASK,
      asks: true,
      sharesOutside: true,
      subject: (input, context) => this.repositorySubject(context, input),
      description: promptText('github/tools-pull-request.review-pull-request'),
      input: z
        .object({
          ...address,
          verdict: z
            .enum(['approve', 'request_changes', 'comment'])
            .describe(promptText('github/tools-pull-request.review-pull-request-verdict')),
          body: z.string().trim().max(REVIEW_COMMENT_MAX).optional().describe('The summary.'),
          comments: z.array(lineComment).max(50).default([]),
        })
        .refine(
          (value) =>
            value.verdict === 'approve' || Boolean(value.body) || value.comments.length > 0,
          {
            path: ['body'],
            message: promptText('github/tools-pull-request.review-pull-request-message'),
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
        return promptText('github/tools-pull-request.review-submitted', {
          verdict: input.verdict,
          number: String(input.number),
        });
      },
    });
  }

  private mergePullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'merge_pull_request',
      scope: 'pulls:write',
      asks: true,
      // Every merge is its own decision: no Allow, no standing grant.
      perCallOnly: true,
      description: promptText('github/tools-pull-request.merge-pull-request'),
      input: z.object({
        ...address,
        method: z
          .enum(MERGE_METHODS)
          .default('squash')
          .describe(promptText('github/tools-pull-request.merge-pull-request-method')),
        head_sha: z
          .string()
          .regex(/^[0-9a-f]{40}$/)
          .optional()
          .describe(promptText('github/tools-pull-request.merge-pull-request-head-sha')),
      }),
      // The card is pinned to the head it was raised on, so a yes merges what the card showed.
      normalize: async (input, context) => {
        const pull = await this.pull(context, input);
        if (pull.state !== 'open') {
          throw new BotToolRefusal(
            promptText('github/tools-pull-request.merge-nothing-to-merge', {
              number: String(input.number),
              state: pull.state,
            }),
          );
        }
        if (input.head_sha && pull.headSha !== input.head_sha) {
          throw new BotToolRefusal(
            promptText('github/tools-pull-request.merge-new-commits', {
              number: String(input.number),
              headSha: pull.headSha.slice(0, 7),
            }),
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
            expectedHeadSha: input.head_sha,
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
      description: promptText('github/tools-pull-request.start-review-session'),
      input: z.object({
        ...address,
        host_id: z
          .uuid()
          .optional()
          .describe(promptText('github/tools-pull-request.start-review-session-host-id')),
        watch: z
          .boolean()
          .optional()
          .describe(promptText('github/tools-pull-request.start-review-session-watch')),
      }),
      normalize: (input, context) => {
        const hostId = input.host_id ?? context.homeHostId;
        if (!hostId) {
          throw new BotToolRefusal(
            promptText('github/tools-pull-request.start-review-session-normalize'),
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
            promptText('github/tools-pull-request.start-review-session-normalize'),
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
          ? ` ${promptText('github/tools-pull-request.review-session-host-offline')}`
          : '';
        const watched =
          input.watch === false
            ? promptText('github/tools-pull-request.review-session-not-watched')
            : await this.watches.follow(context, result.sessionId, 'first_task');
        return {
          content: promptText('github/tools-pull-request.start-review-session-content', {
            sessionId: result.sessionId,
            number: String(input.number),
            hostId,
            offline,
            watched,
          }),
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

  /** The pull request as a card names it; by number alone when it cannot be read. */
  private async target(context: BotToolCallContext, input: Address): Promise<string> {
    const pull = await this.pull(context, input).catch(() => null);
    return pull
      ? describeTarget(pull.repository, pull.number, pull.title)
      : `pull request #${input.number} (repo ${input.github_repo_id})`;
  }

  /** The repository a call acts on, as a card offers to always allow the tool there. */
  private async repositorySubject(
    context: BotToolCallContext,
    input: Address,
  ): Promise<BotToolSubject> {
    const pull = await this.pull(context, input).catch(() => null);
    return repositorySubject(input, pull?.repository ?? null);
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

/** A bot names a repository by its installation: its tools reach only what the App does. */
function addressOf(input: Address) {
  return {
    kind: 'installation' as const,
    installationId: input.installation_id,
    githubRepoId: input.github_repo_id,
    number: input.number,
  };
}
