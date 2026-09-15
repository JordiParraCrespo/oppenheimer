import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { parse } from 'yaml';
import { QA_ROOT, SCENARIOS_DIR } from './paths.js';

/** One case inside a scenario that tests several related failures at once. */
export interface ScenarioCase {
  id: string;
  case: string;
  expected: string;
}

/**
 * What a scenario proves, in the shared vocabulary of `qa/taxonomy.yaml`.
 *
 * `primary` means this scenario executes the product boundary the id names.
 * `secondary` is supporting evidence, which may stand alone. Keeping the two
 * apart is what lets `qa coverage` say "nothing primarily proves this" rather
 * than counting a passing mention as proof.
 */
export interface ScenarioCoverage {
  primary: string[];
  secondary: string[];
}

/** A spec that already exists elsewhere and is adopted as this scenario's evidence. */
export interface ScenarioExecution {
  kind: 'playwright';
  /** Repo-relative path, e.g. `e2e/tests/api/password-reset.spec.ts`. */
  path: string;
  summary?: string;
}

export interface Scenario {
  id: string;
  title: string;
  theme: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** The database state this scenario needs before it runs. */
  fixture: string;
  tags: string[];
  intent: string;
  coverage: ScenarioCoverage;
  /** Documentation this scenario is checking the truth of. */
  docsRefs: string[];
  /** Implementation the scenario exercises, so a touched file finds its proof. */
  codeRefs: string[];
  preconditions: string[];
  steps: string[];
  expected: string[];
  cases: ScenarioCase[];
  /** Screenshots the scenario promises to produce. */
  artifacts: string[];
  execution?: ScenarioExecution;
  /** Where this came from, so an error can name a file. */
  file: string;
}

export interface Theme {
  id: string;
  title: string;
  description: string;
}

export interface FixtureSpec {
  description: string;
  seeds: string[];
  volume?: Record<string, number>;
}

export interface ScenarioPack {
  version: number;
  pack: string;
  environment: Record<string, string>;
  fixtures: Record<string, FixtureSpec>;
  themes: Theme[];
  principles: string[];
  scenarios: Scenario[];
  /** Every coverage id the taxonomy allows, in declaration order. */
  coverageIds: string[];
}

function asArray(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function yamlFilesIn(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...yamlFilesIn(path));
    else if (entry.endsWith('.yaml') && basename(path) !== 'index.yaml') found.push(path);
  }
  return found.sort();
}

interface TaxonomyFile {
  surfaces: Record<string, { title: string; features: string[] }>;
}

/** The coverage ids a scenario may claim. */
export function loadTaxonomy(): string[] {
  const raw = parse(readFileSync(join(QA_ROOT, 'taxonomy.yaml'), 'utf8')) as TaxonomyFile;
  return Object.values(raw.surfaces ?? {}).flatMap((surface) => surface.features ?? []);
}

function readCoverage(raw: unknown, file: string): ScenarioCoverage {
  if (raw === undefined || raw === null) return { primary: [], secondary: [] };
  // The list shape (`coverage: [id]`) is the one OpenClaw retired, and it is
  // ambiguous in exactly the way that matters: it cannot say whether this
  // scenario is the proof or merely touches the behaviour.
  if (Array.isArray(raw)) {
    throw new Error(`${file}: "coverage" must be an object with "primary"/"secondary", not a list`);
  }
  const value = raw as { primary?: unknown; secondary?: unknown };
  return { primary: asArray(value.primary), secondary: asArray(value.secondary) };
}

function readExecution(raw: unknown, file: string): ScenarioExecution | undefined {
  if (!raw) return undefined;
  const value = raw as Partial<ScenarioExecution>;
  if (value.kind !== 'playwright') {
    throw new Error(`${file}: execution.kind must be "playwright" (got ${String(value.kind)})`);
  }
  if (!value.path) throw new Error(`${file}: execution.kind needs an execution.path`);
  return { kind: 'playwright', path: value.path, summary: value.summary };
}

/**
 * Reads the pack off disk.
 *
 * Scenarios are discovered rather than listed: `scenarios/<theme>/<slug>.yaml`
 * is the whole registration mechanism, so adding a case is adding a file. The
 * index carries only what a single scenario cannot say for itself — the shared
 * environment, the fixture catalog, the theme descriptions.
 */
export function loadPack(): ScenarioPack {
  const index = parse(readFileSync(join(SCENARIOS_DIR, 'index.yaml'), 'utf8')) as Omit<
    ScenarioPack,
    'scenarios' | 'coverageIds'
  >;
  const coverageIds = loadTaxonomy();
  const known = new Set(coverageIds);

  const scenarios = yamlFilesIn(SCENARIOS_DIR).map((file) => {
    const raw = parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const relativeFile = relative(SCENARIOS_DIR, file);
    const scenario: Scenario = {
      id: String(raw.id ?? ''),
      title: String(raw.title ?? ''),
      theme: String(raw.theme ?? ''),
      severity: (raw.severity as Scenario['severity']) ?? 'medium',
      fixture: String(raw.fixture ?? 'reset'),
      tags: asArray(raw.tags),
      intent: String(raw.intent ?? '').trim(),
      coverage: readCoverage(raw.coverage, relativeFile),
      docsRefs: asArray(raw.docsRefs),
      codeRefs: asArray(raw.codeRefs),
      preconditions: asArray(raw.preconditions),
      steps: asArray(raw.steps),
      expected: asArray(raw.expected),
      cases: (raw.cases as ScenarioCase[] | undefined) ?? [],
      artifacts: asArray(raw.artifacts),
      execution: readExecution(raw.execution, relativeFile),
      file: relativeFile,
    };
    if (!scenario.id) throw new Error(`${scenario.file}: scenario is missing an "id"`);
    if (!index.fixtures[scenario.fixture]) {
      throw new Error(
        `${scenario.file}: unknown fixture "${scenario.fixture}" — add it to scenarios/index.yaml`,
      );
    }
    if (!index.themes.some((theme) => theme.id === scenario.theme)) {
      throw new Error(`${scenario.file}: unknown theme "${scenario.theme}"`);
    }
    // A coverage id nobody can look up is worse than none: it reads as proof
    // in the report and matches nothing in a search.
    for (const id of [...scenario.coverage.primary, ...scenario.coverage.secondary]) {
      if (!known.has(id)) {
        throw new Error(
          `${scenario.file}: unknown coverage id "${id}" — add it to qa/taxonomy.yaml`,
        );
      }
    }
    return scenario;
  });

  const seen = new Set<string>();
  for (const scenario of scenarios) {
    if (seen.has(scenario.id)) throw new Error(`duplicate scenario id: ${scenario.id}`);
    seen.add(scenario.id);
  }

  // Sorted by id, not by filename: the report and the coverage table read as
  // an ordered inventory, and a file renamed for clarity must not reshuffle it.
  scenarios.sort((a, b) => a.id.localeCompare(b.id));

  return { ...index, scenarios, coverageIds };
}

/** Look one up by id, failing loudly — a spec bound to a deleted scenario is a bug. */
export function requireScenario(pack: ScenarioPack, id: string): Scenario {
  const scenario = pack.scenarios.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`no scenario with id "${id}" in qa/scenarios`);
  return scenario;
}

/** Everything about a scenario a `--match` query is allowed to hit. */
export function searchableText(scenario: Scenario): string {
  return [
    scenario.id,
    scenario.title,
    scenario.theme,
    ...scenario.tags,
    ...scenario.coverage.primary,
    ...scenario.coverage.secondary,
    ...scenario.docsRefs,
    ...scenario.codeRefs,
    scenario.execution?.path ?? '',
  ]
    .join('\n')
    .toLowerCase();
}
