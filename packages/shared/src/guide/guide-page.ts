/**
 * One page of "Using Oppenheimer", the guide the docs site publishes under
 * `/guide/<id>` and every bot reads through `read_oppenheimer_docs`.
 */
export interface GuidePage {
  /** Its file name in `apps/docs/docs/guide` without `.md`, and its address on the site. */
  id: string;
  title: string;
  /** One sentence on what it covers: the index entry a bot chooses pages by. */
  description: string;
  /** The page as Markdown, without its frontmatter. Links to others read `./<id>.md`. */
  body: string;
}
