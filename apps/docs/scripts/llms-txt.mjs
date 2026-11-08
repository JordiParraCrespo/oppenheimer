/**
 * Publishes the guide for agents outside Oppenheimer, the way Claude's docs
 * do: `/llms.txt` lists every page of "Using Oppenheimer" with what it covers
 * (llmstxt.org), and each page is served beside its HTML as plain Markdown
 * at `/guide/<id>.md`. An agent on another host, an MCP client or someone's
 * own Claude Code reads the same pages a bot in Oppenheimer reads through
 * `read_oppenheimer_docs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readGuidePages } from './guide-pages.mjs';

export default function llmsTxt(context) {
  return {
    name: 'oppenheimer-llms-txt',
    async postBuild({ outDir }) {
      const site = `${context.siteConfig.url.replace(/\/+$/, '')}${context.baseUrl}`;
      const pages = readGuidePages();
      mkdirSync(join(outDir, 'guide'), { recursive: true });
      for (const page of pages) {
        writeFileSync(join(outDir, 'guide', `${page.id}.md`), `# ${page.title}\n\n${page.body}\n`);
      }
      const index = [
        '# Oppenheimer',
        '',
        '> A browser console for running coding agents (Claude Code, Codex) in sessions on machines you own, with bots that work for you through them. These pages are its user guide, "Using Oppenheimer".',
        '',
        '## Using Oppenheimer',
        '',
        ...pages.map(
          (page) => `- [${page.title}](${site}guide/${page.id}.md): ${page.description}`,
        ),
        '',
      ];
      writeFileSync(join(outDir, 'llms.txt'), index.join('\n'));
    },
  };
}
