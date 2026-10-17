import { describe, expect, it } from 'vitest';
import { claudeWebSearchResults, searchResults, zaiWebSearchResults } from '../lib/search-results';

/**
 * A search step's pages come from structured data its output carries, read
 * by one parser per provider shape, and from nothing else. The regressions
 * this guards: free text scraped for anything that looks like a link, a
 * `javascript:` address drawn as a source, and JSON the output cut short
 * drawn as if it were whole.
 */

/**
 * Real outputs of GLM's WebSearch (z.ai's `web_search_prime`), as the API
 * stored them on 2026-10-15: the CLI cuts the result array mid-object, and
 * the API cuts the whole at 2,000 characters.
 */
const ZAI_CAPTURED = [
  'Web search results for query: "current Node.js LTS version"\n\n**🌐 Z.ai Built-in Tool: web_search_prime**\n\n**Input:**\n```json\n{"location":"us","search_query":"current Node.js LTS version"}\n```\n*Executing on server...*\n\n**Output:**\n**web_search_prime_result_summary:** [{"text": [{"title": "Node.js Releases", "link": "https://nodejs.org/en/about/previous-releases", "content": "Node . js versions enter Current release status for six months, even-numbered releases (10, 12, etc.) move to Active LTS status and are ready for general use.", "refer": "ref_1"}, {"title": ...\n                                                Here\'s a summary of the search results for the current Node.js LTS version:\n\n**Key Findings:**\n\n1. **Latest LTS Version: Node.js 24 (v24.22.0)** — According to the official Node.js website (nodejs.org), the latest LTS version is **v24.22.0**, codenamed "Krypton". Node.js 24 entered LTS status around October 2025 (starting with v24.11.0).\n\n2. **Latest Current Release: v26.12.0** — The newest non-LTS release line is Node.js 26, which is expected to become the next LTS (per endoflife.date).\n\n3. **Other active/maintenance versions:**\n   - **Node.js 22** — still supported, currently in Maintenance LTS mode\n   - **Node.js 24** — Active LTS, with end-of-life scheduled for April 30, 2028\n   - **Node.js 26** — Current/upcoming LTS candidate\n\n4. **LTS lifecycle context:** Node.js releases enter "Current" status for six months, then even-numbered versions transition to Active LTS for ~18 months, followed by Maintenance LTS, with total support lasting about 30 months.\n\n**Sources:** nodejs.org (official releases page), endoflife.date, Wikipedia, HeroDevs blog, and NodeSource.\n\n\nREMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.',
  'Web search results for query: "Node.js release schedule LTS October 2026"\n\n**🌐 Z.ai Built-in Tool: web_search_prime**\n\n**Input:**\n```json\n{"location":"us","search_query":"Node.js release schedule LTS October 2026"}\n```\n*Executing on server...*\n\n**Output:**\n**web_search_prime_result_summary:** [{"text": [{"title": "Node.js Releases", "link": "https://nodejs.org/en/about/previous-releases", "content": "New security releases to be made available Wednesday, October 21, 2026. Full details regarding the Node.js release schedule are available on GitHub. 2026 Oct ...", "refer": "ref_1"}, {"title...\n                                                Here\'s a summary of the search results for **Node.js release schedule LTS October 2026**:\n\n## Key Findings\n\n**Node.js 26 Enters LTS in October 2026**\n- Node.js 26, released in May 2026 (version 26.11.1 is latest as of October 2026), transitions from Current to **Active LTS on October 28, 2026** (per NodeSource Weekly)\n- Node.js 24 (Krypton) will simultaneously transition from Active LTS to Maintenance LTS\n\n**Major Release Schedule Change Announced**\n- Node.js is changing its release schedule for the first time in 10 years (announced June 2026)\n- Starting October 2026, the project moves from the odd/even versioning rule to **one major release per year** — Node.js 26 is the last release under the old 6-month cycle\n- LTS duration remains ~30 months (roughly 36 months from first release to end of life)\n- The change is described as making the schedule "easier to know and remember"\n\n**Current Status (October 2026)**\n- **Node 26**: Upcoming LTS (starts ~Oct 20–28, 2026; ends Oct 27, 2027)\n- **Node 24**: LTS\n- **Node 22**: LTS (nearing maintenance/EOL)\n- Security releases for 26.x, 24.x, and 22.x lines scheduled for **Wednesday, October 21, 2026**\n\n**Sources**: nodejs.org (official release schedule), endoflife.date/nodejs, nodejsdesignpatterns.com, herodevs.com, eosl.date, and nodesource.com\n\nWould you like me to search for more details on…',
  'Web search results for query: "AbortSignal.timeout browser support"\n\n**🌐 Z.ai Built-in Tool: web_search_prime**\n\n**Input:**\n```json\n{"location":"us","search_query":"AbortSignal.timeout browser support"}\n```\n*Executing on server...*\n\n**Output:**\n**web_search_prime_result_summary:** [{"text": [{"title": "AbortSignal: timeout() static method - Web APIs | MDN", "link": "https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static", "content": "Sep 1, 2026 — This feature might not work in older devices or browsers . See full compatibility Learn more Note: This featu...\n                                                Here\'s a summary of the search results for **AbortSignal.timeout browser support**:\n\n## Key Findings\n\n**Browser Support (per Can I Use):**\n- **Chrome**: Supported from version 124 onward (not supported in versions 4–123)\n- **Safari**: Supported from version 16.0 onward (not supported in 3.1–15.6)\n- **Edge**: Supported\n- **Firefox**: Supported (per MDN baseline status)\n\n**Overall Support Level:**\n- BaseWatch reports **88.3% global browser support**, categorizing it as "newly available" — usable for current evergreen browsers, but older browsers may lack support\n- MDN notes the feature has been Baseline (widely available) **since April 2024**\n- Available in Web Workers as well\n\n**Notable Issues:**\n- A known Chromium bug (issue 40263649, also discussed on Stack Overflow) where `AbortSignal.timeout()` in fetch requests responds with an `AbortError` unexpectedly in Chromium-based browsers (Chrome, Edge), while working correctly in Firefox\n\n**Key Sources:**\n- [MDN – AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)\n- [Can I Use – AbortSignal.timeout()](https://caniuse.com/wf-abortsignal-timeout)\n- [BaseWatch – 88.3% support](https://basewatch.dev/feature/wf-abortsignal-timeout)\n\n**Bottom line:** `AbortSignal.timeout()` is now broadly supported across all major modern browsers (Chrome 124+, Safari 16+…',
];

/**
 * Claude Code's WebSearch result, in the shape its tool reports
 * (`Links: ` and the JSON array on one line). Not captured: this workspace
 * has no Anthropic key, so it follows the tool's own format.
 */
const CLAUDE_OUTPUT = [
  'Web search results for query: "node lts"',
  '',
  `Links: ${JSON.stringify([
    { title: 'Node.js — Previous releases', url: 'https://nodejs.org/en/about/previous-releases' },
    { title: 'Node.js | endoflife.date', url: 'https://endoflife.date/nodejs' },
    { title: 'Node.js — Previous releases', url: 'https://nodejs.org/en/about/previous-releases' },
  ])}`,
  '',
  'Node.js 24 is the Active LTS line.',
].join('\n');

describe('claudeWebSearchResults', () => {
  it('reads the Links line, once per address', () => {
    expect(claudeWebSearchResults(CLAUDE_OUTPUT)).toEqual([
      {
        title: 'Node.js — Previous releases',
        url: 'https://nodejs.org/en/about/previous-releases',
      },
      { title: 'Node.js | endoflife.date', url: 'https://endoflife.date/nodejs' },
    ]);
  });

  it('answers nothing for a line that does not validate', () => {
    const script = `Links: ${JSON.stringify([{ title: 'x', url: 'javascript:alert(1)' }])}`;
    expect(claudeWebSearchResults(script)).toBeNull();
    expect(claudeWebSearchResults('Links: [{"title": "cut')).toBeNull();
    expect(claudeWebSearchResults('no links here')).toBeNull();
  });
});

describe('zaiWebSearchResults', () => {
  it('reads a whole result summary', () => {
    const whole = `**web_search_prime_result_summary:** ${JSON.stringify([
      {
        text: [
          {
            title: 'AbortSignal: timeout() static method',
            link: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static',
            content: 'Baseline 2022',
            refer: 'ref_1',
          },
        ],
      },
    ])}`;
    expect(zaiWebSearchResults(whole)).toEqual([
      {
        title: 'AbortSignal: timeout() static method',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static',
      },
    ]);
  });

  /** What the provider actually returns today: the summary is cut, so there are no sources to draw. */
  it('answers nothing for every captured output, whose summary the CLI cut short', () => {
    for (const output of ZAI_CAPTURED) expect(zaiWebSearchResults(output)).toBeNull();
  });
});

describe('searchResults', () => {
  it('takes the first provider shape that reads the output whole, and none otherwise', () => {
    expect(searchResults(CLAUDE_OUTPUT)).toHaveLength(2);
    for (const output of ZAI_CAPTURED) expect(searchResults(output)).toEqual([]);
    expect(searchResults('see https://example.com "title": "x", "url": "https://x.dev"')).toEqual(
      [],
    );
  });
});
