/** A page `web_fetch` read, as text. */
export interface WebPage {
  /** Where it ended up, after redirects. */
  url: string;
  status: number;
  contentType: string;
  title: string | null;
  text: string;
  /** The body was longer than the fetch reads, and was cut. */
  truncated: boolean;
}

/** What one fetch came to: the page, or why there is none, in words for the model. */
export type WebPageResult =
  | { kind: 'page'; page: WebPage }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; reason: string };

/**
 * Reads a public web page for a bot (`25-bots.md` §4.7). The adapter, not
 * its caller, owns the rule that only public addresses are reached: every
 * address a host name resolves to, and every redirect, is checked.
 */
export interface WebPagePort {
  fetch(url: string, signal: AbortSignal): Promise<WebPageResult>;
}
