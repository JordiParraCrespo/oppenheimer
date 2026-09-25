import { z } from 'zod';
import { paginationSchema } from '../schemas/pagination.schema';
import { armWidth, FLAG_BUCKETS } from './evaluate';
import { FLAG_ATTRIBUTES, FLAG_OPERATORS } from './types';

/**
 * Write schemas for flag targeting and segments. Shape only: whether a served
 * value is valid for a *particular* flag (a variant it declares, a boolean for
 * a boolean flag) depends on the catalog entry, and is checked by the API
 * against it.
 */

/** Past this many values a list belongs in a segment, where it is written once. */
export const MAX_CONDITION_VALUES = 500;
/** A segment is where long ID lists live, so it may hold more. */
export const MAX_SEGMENT_CONDITION_VALUES = 10_000;
export const MAX_FLAG_RULES = 50;

const conditionValues = (max: number) => z.array(z.string().min(1).max(320)).min(1).max(max);

export const flagConditionSchema = z.object({
  attribute: z.enum(FLAG_ATTRIBUTES),
  operator: z.enum(FLAG_OPERATORS),
  values: conditionValues(MAX_CONDITION_VALUES),
});

const segmentConditionSchema = z
  .object({
    attribute: z.enum(FLAG_ATTRIBUTES),
    operator: z.enum(FLAG_OPERATORS),
    values: conditionValues(MAX_SEGMENT_CONDITION_VALUES),
  })
  .refine((condition) => condition.attribute !== 'segment', {
    message: 'A segment cannot reference another segment',
    path: ['attribute'],
  });

export const flagValueSchema = z.union([z.boolean(), z.string().min(1).max(64)]);

/**
 * A split arm's weight: a percentage in 0.01 % steps, the resolution of the
 * {@link FLAG_BUCKETS} buckets a split is walked over.
 */
export const flagSplitArmSchema = z.object({
  value: flagValueSchema,
  weight: z
    .number()
    .min(0)
    .max(100)
    .refine((weight) => Math.abs(armWidth(weight) - weight * (FLAG_BUCKETS / 100)) < 1e-6, {
      message: 'Split weights are percentages with at most two decimals',
    }),
});

export const flagServeSchema = z.union([
  z.object({ value: flagValueSchema }).strict(),
  z
    .object({ split: z.array(flagSplitArmSchema).min(1).max(10) })
    .strict()
    // The unit the evaluator walks, not the floats: widths that sum to exactly
    // FLAG_BUCKETS leave no bucket uncovered.
    .refine(
      (serve) => serve.split.reduce((sum, arm) => sum + armWidth(arm.weight), 0) === FLAG_BUCKETS,
      { message: 'Split weights must add up to 100', path: ['split'] },
    ),
]);

export const flagRuleSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  description: z.string().max(255).optional(),
  conditions: z.array(flagConditionSchema).max(20),
  serve: flagServeSchema,
});

/** Why a change was made. Recorded on the audit trail beside the diff. */
const changeComment = z.string().trim().max(500).optional();

/** Replace a flag's whole targeting on this deployment. */
export const updateFeatureFlagSchema = z
  .object({
    enabled: z.boolean(),
    rules: z.array(flagRuleSchema).max(MAX_FLAG_RULES),
    fallthrough: flagServeSchema,
    comment: changeComment,
  })
  .refine((body) => new Set(body.rules.map((rule) => rule.id)).size === body.rules.length, {
    message: 'Rule ids must be unique',
    path: ['rules'],
  });

/** Flip the master switch alone — the kill-switch path, kept to one field. */
export const toggleFeatureFlagSchema = z.object({
  enabled: z.boolean(),
  comment: changeComment,
});

export const flagSegmentKeySchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);

export const createFlagSegmentSchema = z.object({
  key: flagSegmentKeySchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().max(255).optional(),
  conditions: z.array(segmentConditionSchema).min(1).max(20),
  comment: changeComment,
});

export const updateFlagSegmentSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(255).nullable().optional(),
  conditions: z.array(segmentConditionSchema).min(1).max(20).optional(),
  comment: changeComment,
});

/** `DELETE /segments/:key?comment=` — the why, as for every other change. */
export const deleteFlagSegmentSchema = z.object({
  comment: changeComment,
});

/**
 * What a client says about itself when it asks for its flags. Self-reported,
 * so it is fit for targeting (serve the new screen to builds that have it) and
 * never for authorization.
 */
export const clientFlagContextSchema = z.object({
  platform: z.enum(['web', 'ios', 'android']).optional(),
  appVersion: z.string().max(32).optional(),
});

/** Context a caller may ask the control plane to evaluate a flag against ("explain"). */
export const evaluateFeatureFlagSchema = z.object({
  userId: z.string().max(64).optional(),
  organizationId: z.string().max(64).optional(),
  email: z.string().max(320).optional(),
  platformRole: z.string().max(64).optional(),
  platform: z.enum(['web', 'ios', 'android', 'server']).optional(),
  appVersion: z.string().max(32).optional(),
});

/** Filters for the audit trail. Omitting both lists every change, newest first. */
export const findFlagChangesSchema = paginationSchema.extend({
  subjectType: z.enum(['flag', 'segment']).optional(),
  subjectKey: z.string().max(64).optional(),
});

export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
export type ToggleFeatureFlagInput = z.infer<typeof toggleFeatureFlagSchema>;
export type CreateFlagSegmentInput = z.infer<typeof createFlagSegmentSchema>;
export type UpdateFlagSegmentInput = z.infer<typeof updateFlagSegmentSchema>;
export type DeleteFlagSegmentInput = z.infer<typeof deleteFlagSegmentSchema>;
export type ClientFlagContextInput = z.infer<typeof clientFlagContextSchema>;
export type FindFlagChangesInput = z.infer<typeof findFlagChangesSchema>;
export type EvaluateFeatureFlagInput = z.infer<typeof evaluateFeatureFlagSchema>;
