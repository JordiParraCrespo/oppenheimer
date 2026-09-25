import {
  compareSemver,
  type FlagCondition,
  type FlagDefinition,
  type FlagServe,
  isValidFlagValue,
} from '@oppenheimer/shared/feature-flags';
import type { FlagTargeting } from './feature-flag.entity';

/**
 * What the request schema cannot know: whether targeting makes sense for *this*
 * flag. The schema checks shape; this checks meaning against the catalog entry
 * and the segments that exist.
 *
 * Returns every problem rather than the first, so the control plane can show
 * them all at once. An empty list means valid.
 */
export function targetingProblems(
  definition: FlagDefinition,
  targeting: FlagTargeting,
  knownSegments: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];

  targeting.rules.forEach((rule, index) => {
    const where = `rules[${index}] (${rule.id})`;
    problems.push(...serveProblems(definition, rule.serve, where));
    rule.conditions.forEach((condition, conditionIndex) => {
      problems.push(
        ...conditionProblems(condition, `${where}.conditions[${conditionIndex}]`, knownSegments),
      );
    });
  });
  problems.push(...serveProblems(definition, targeting.fallthrough, 'fallthrough'));

  return problems;
}

/** The same meaning checks for a segment's own conditions. */
export function segmentProblems(conditions: FlagCondition[]): string[] {
  return conditions.flatMap((condition, index) =>
    conditionProblems(condition, `conditions[${index}]`, null),
  );
}

function serveProblems(definition: FlagDefinition, serve: FlagServe, where: string): string[] {
  const allowed =
    definition.type === 'boolean' ? 'true or false' : `one of ${definition.variants.join(', ')}`;

  if ('value' in serve) {
    return isValidFlagValue(definition, serve.value)
      ? []
      : [`${where}: ${JSON.stringify(serve.value)} is not a value this flag takes (${allowed})`];
  }

  const problems = serve.split
    .filter((arm) => !isValidFlagValue(definition, arm.value))
    .map(
      (arm) => `${where}: ${JSON.stringify(arm.value)} is not a value this flag takes (${allowed})`,
    );
  const values = serve.split.map((arm) => arm.value);
  if (new Set(values).size !== values.length) {
    problems.push(`${where}: a split lists the same value twice`);
  }
  return problems;
}

function conditionProblems(
  condition: FlagCondition,
  where: string,
  knownSegments: ReadonlySet<string> | null,
): string[] {
  const { attribute, operator, values } = condition;

  if (attribute === 'segment') {
    if (knownSegments === null) return [`${where}: a segment cannot reference another segment`];
    const problems: string[] = [];
    if (operator !== 'in' && operator !== 'not_in') {
      problems.push(`${where}: segments are matched with "in" or "not_in"`);
    }
    for (const key of values) {
      if (!knownSegments.has(key)) problems.push(`${where}: there is no segment "${key}"`);
    }
    return problems;
  }

  if (operator === 'semver_gte' || operator === 'semver_lt') {
    if (attribute !== 'appVersion') {
      return [`${where}: version comparison only applies to appVersion`];
    }
    const target = values[0] ?? '';
    if (values.length !== 1 || compareSemver(target, target) === null) {
      return [`${where}: version comparison takes exactly one version, like 2.1.0`];
    }
  }

  return [];
}
