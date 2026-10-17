import { z } from 'zod';

/**
 * The pages a web search found, read from the call's output when the
 * output carries them as structured data, and only then. The API stores a
 * tool's output as text, cut at 2,000 characters, so each provider's shape
 * has its own parser here: it finds the line that holds the JSON by its
 * label, parses it whole and validates it. Anything else (prose, JSON the
 * cut broke, a shape no parser knows) is no sources: the step then shows
 * its raw output, never a guess.
 */

/** A page a web search found. */
export interface SearchResult {
  title: string;
  url: string;
}

const MAX_RESULTS = 8;

/** Only web addresses: a page link never runs script or opens anything else. */
const webUrl = z
  .string()
  .url()
  .refine((url) => url.startsWith('https://') || url.startsWith('http://'));

/** The JSON on the output's line that starts with `label`, parsed; `undefined` when absent or broken. */
function labelledJson(output: string, label: string): unknown {
  const line = output.split('\n').find((row) => row.startsWith(label));
  if (line === undefined) return undefined;
  try {
    return JSON.parse(line.slice(label.length));
  } catch {
    return undefined;
  }
}

/** The first pages, once each by address. */
function distinct(results: readonly SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results
    .filter((result) => !seen.has(result.url) && seen.add(result.url))
    .slice(0, MAX_RESULTS);
}

/**
 * Claude Code's WebSearch: `Web search results for query: "…"`, then a
 * `Links: [{"title":…,"url":…}]` line per batch of results, then the
 * model's summary.
 */
const claudeLinksSchema = z.array(z.object({ title: z.string(), url: webUrl }));

export function claudeWebSearchResults(output: string): SearchResult[] | null {
  const parsed = claudeLinksSchema.safeParse(labelledJson(output, 'Links: '));
  return parsed.success ? distinct(parsed.data) : null;
}

/**
 * z.ai's `web_search_prime`, as GLM's Anthropic endpoint reports it:
 * `**web_search_prime_result_summary:** [{"text":[{"title","link",…}]}]`.
 * The CLI cuts that array short before the API does, so in practice it
 * rarely parses whole; when it does not, this answers nothing.
 */
const zaiSummarySchema = z.array(
  z.object({ text: z.array(z.object({ title: z.string(), link: webUrl })) }),
);

export function zaiWebSearchResults(output: string): SearchResult[] | null {
  const parsed = zaiSummarySchema.safeParse(
    labelledJson(output, '**web_search_prime_result_summary:** '),
  );
  if (!parsed.success) return null;
  return distinct(
    parsed.data.flatMap((batch) => batch.text.map(({ title, link }) => ({ title, url: link }))),
  );
}

const PARSERS = [claudeWebSearchResults, zaiWebSearchResults];

/** A search's pages, from the first provider shape that reads its output whole; none otherwise. */
export function searchResults(output: string): SearchResult[] {
  for (const parse of PARSERS) {
    const results = parse(output);
    if (results) return results;
  }
  return [];
}
