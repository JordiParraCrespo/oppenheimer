import { z } from 'zod';

/**
 * The Pull requests area (`product/next-steps/0.2-pull-requests-api-plan.md`,
 * drawn in `product/versions/mvp/design/version1/PullRequests.dc.html`). Pull
 * requests are GitHub's: nothing here mirrors one, a request names it by the
 * installation that reaches it, the repository and its number.
 */

/** Whose pull requests the queue shows: yours and your sessions', review requests, the rest of the watched repositories. */
export const PULL_REQUEST_SCOPES = ['mine', 'requested', 'watching'] as const;
export type PullRequestScope = (typeof PULL_REQUEST_SCOPES)[number];

/** How much reading a change needs, decided by the lane policy. */
export const PULL_REQUEST_LANES = ['deep', 'medium', 'quick'] as const;
export type PullRequestLane = (typeof PULL_REQUEST_LANES)[number];

/** What submitting a review does: comment only, approve (and merge when it can), or send it back. */
export const REVIEW_VERDICTS = ['comment', 'approve', 'request_changes'] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export const MERGE_METHODS = ['squash', 'merge', 'rebase'] as const;
export type MergeMethod = (typeof MERGE_METHODS)[number];

/** The analytics ranges the header offers. */
export const PULL_REQUEST_ANALYTICS_RANGES = ['week', 'month', 'quarter'] as const;
export type PullRequestAnalyticsRange = (typeof PULL_REQUEST_ANALYTICS_RANGES)[number];

export const REVIEW_COMMENT_MAX = 65_000;

/** `GET /pulls`. */
export const pullRequestsQuerySchema = z.object({
  scope: z.enum(PULL_REQUEST_SCOPES).default('mine'),
});
export type PullRequestsQueryDto = z.infer<typeof pullRequestsQuerySchema>;

const commentBodySchema = z.string().trim().min(1).max(REVIEW_COMMENT_MAX);

/** A comment on one line of the diff: the side is GitHub's (`RIGHT` is the new file). */
export const reviewLineCommentSchema = z.object({
  path: z.string().min(1).max(4096),
  line: z.number().int().positive(),
  side: z.enum(['LEFT', 'RIGHT']).default('RIGHT'),
  body: commentBodySchema,
});
export type ReviewLineCommentDto = z.infer<typeof reviewLineCommentSchema>;

/** `POST /pulls/…/reviews`: the verdict, its comment, and the pending line comments it carries. */
export const submitPullRequestReviewSchema = z
  .object({
    verdict: z.enum(REVIEW_VERDICTS),
    body: z.string().trim().max(REVIEW_COMMENT_MAX).optional(),
    comments: z.array(reviewLineCommentSchema).max(100).default([]),
  })
  // GitHub refuses a review that asks for changes, or only comments, with nothing to say.
  .refine(
    (value) => value.verdict === 'approve' || Boolean(value.body) || value.comments.length > 0,
    {
      path: ['body'],
    },
  );
export type SubmitPullRequestReviewDto = z.infer<typeof submitPullRequestReviewSchema>;

/** `POST /pulls/…/comments`: one line comment posted at once, outside a review. */
export const addPullRequestCommentSchema = reviewLineCommentSchema;
export type AddPullRequestCommentDto = z.infer<typeof addPullRequestCommentSchema>;

/** `POST /pulls/…/merge`. */
export const mergePullRequestSchema = z.object({
  method: z.enum(MERGE_METHODS).default('squash'),
});
export type MergePullRequestDto = z.infer<typeof mergePullRequestSchema>;

/** `PUT /pulls/repositories/…`: watch a repository, or stop. */
export const setRepositoryWatchSchema = z.object({
  watching: z.boolean(),
});
export type SetRepositoryWatchDto = z.infer<typeof setRepositoryWatchSchema>;

/** `GET /pulls/analytics`. */
export const pullRequestAnalyticsQuerySchema = z.object({
  range: z.enum(PULL_REQUEST_ANALYTICS_RANGES).default('month'),
});
export type PullRequestAnalyticsQueryDto = z.infer<typeof pullRequestAnalyticsQuerySchema>;
