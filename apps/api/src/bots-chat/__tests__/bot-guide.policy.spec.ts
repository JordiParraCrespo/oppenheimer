/**
 * Every bot knows Oppenheimer from its own guide (`25-bots.md` §4.1,
 * "Oppenheimer's own guide"): the prompt lists the built-in `oppenheimer`
 * skill whenever the turn can read the guide, and `read_oppenheimer_docs`
 * answers with the pages the docs site publishes. What breaks this: the
 * skill listed on a turn that cannot read the guide (the bot is told to call
 * a tool it does not have), or missing from one that can (it answers "how do
 * I pair a host?" from its training); a page asked for by the link a page
 * carries (`./hosts.md`) not found; a deployment's docs address dropped from
 * the answer, or one invented where none is configured. That the bundled
 * pages are the site's own is `pnpm --filter @oppenheimer/docs check:guide`.
 */
import { GUIDE_PAGES } from '@oppenheimer/shared/guide';
import { guideIndexText, guidePageText } from '../domain/bot-guide.policy';
import { type BotPromptInput, composeBotSystemPrompt } from '../domain/bot-prompt.policy';
import { OPPENHEIMER_SKILL, withBuiltInSkills } from '../domain/bot-skill.policy';

const tool = (name: string) => ({ name, description: `Does ${name}.` });

const base: BotPromptInput = {
  name: 'Juno',
  description: '',
  soul: '',
  instructions: 'Review pull requests.',
  facts: [],
  engineCapabilities: [],
  tools: [],
};

describe('the oppenheimer skill in the prompt', () => {
  it('is listed when the turn can read a skill and read the guide, as the bot’s to use unasked', () => {
    const prompt = composeBotSystemPrompt({
      ...base,
      tools: [tool('use_skill'), tool('read_oppenheimer_docs')],
    });
    expect(prompt).toContain('# Your skills');
    expect(prompt).toContain(`- \`oppenheimer\`: ${OPPENHEIMER_SKILL.description}`);
  });

  it('is left out of a turn that cannot read the guide, even with use_skill offered', () => {
    const prompt = composeBotSystemPrompt({ ...base, tools: [tool('use_skill')] });
    expect(prompt).not.toContain('`oppenheimer`');
  });

  it('gives way to a skill of the bot’s own saved under the name before it was reserved', () => {
    const own = {
      name: 'oppenheimer',
      description: 'My old notes.',
      body: 'Old.',
      userInvocable: true,
      modelInvocable: true,
    };
    const skills = withBuiltInSkills([own], ['use_skill', 'read_oppenheimer_docs']);
    expect(skills).toEqual([own]);
  });

  it('is not one the person runs as a command', () => {
    expect(OPPENHEIMER_SKILL).toMatchObject({ userInvocable: false, modelInvocable: true });
  });
});

describe('read_oppenheimer_docs', () => {
  it('lists every page of the guide by id, title and what it covers', () => {
    expect(GUIDE_PAGES.length).toBeGreaterThan(0);
    const index = guideIndexText(null);
    for (const page of GUIDE_PAGES) {
      expect(index).toContain(`- \`${page.id}\`: ${page.title}. ${page.description}`);
    }
    expect(index).not.toContain('http');
  });

  it('returns a page whole by its id, or by the link another page carries', () => {
    const page = GUIDE_PAGES[0];
    for (const reference of [page.id, `./${page.id}.md`, `guide/${page.id}`]) {
      expect(guidePageText(reference, null)).toBe(`# ${page.title}\n\n${page.body}`);
    }
  });

  it('links the page on the deployment’s docs site when one is configured', () => {
    const page = GUIDE_PAGES[0];
    const text = guidePageText(page.id, 'https://docs.example.com/');
    expect(text).toContain(`On the docs site: https://docs.example.com/guide/${page.id}`);
    expect(guideIndexText('https://docs.example.com')).toContain(
      'It is published at https://docs.example.com/guide.',
    );
  });

  it('answers a page it does not have with the index, so the bot can pick again', () => {
    const text = guidePageText('billing', null);
    expect(text).toContain('The guide has no page "billing".');
    expect(text).toContain(guideIndexText(null));
  });
});
