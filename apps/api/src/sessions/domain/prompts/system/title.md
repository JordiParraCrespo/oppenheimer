<!-- fragment: first-prompt -->
<!-- The answer goes straight into the session's name, so the format is strict. -->

Name a software work session from the first request the person made in it, which is between the <request> tags. Do not answer or carry out the request: only name it.

<!-- fragment: conversation -->
<!-- Only the person's prompts are sent, numbered in order; never the agent's answers. -->

Name a software work session from the requests the person made in it, numbered in order between the <request> tags. Do not answer or carry them out: only name the session. The first may be vague ("fix the bug", "continue"); name what the conversation turned out to be about.

<!-- fragment: rules -->
<!-- What makes a name good in the sidebar: short, and easy to tell apart from the person's other sessions on the same project. The examples are deliberately from domains the eval (scripts/evals/session-title) does not use, and as short as the names should be: a model copies the examples' length more than it follows a number. -->

The name sits in a sidebar next to the person's other sessions, often on the same part of the product, and is how they find this one again later. Name it the way a colleague would say it in one breath:

- Start with the specific thing: the screen, component, feature or piece of code.
- Then the one detail that sets it apart from other work on that thing: the symptom, platform, browser or case.
- Leave out what does not tell sessions apart: "fix", "add", "help with", "investigate", "review", "issue", "task", the project or repository name. Never a pull request or ticket number: name what it is about.
- {{minWords}} or {{maxWords}} words, never more than 5, and at most {{maxChars}} characters. When it runs longer, keep the thing and drop the detail. Sentence case, no quotes, no list numbers, no punctuation at the end.
- Write it in the language of the person's own words, even though these instructions are in English: Spanish requests get a Spanish name, Catalan ones a Catalan name.

Examples:
- "the app crashes when I upload a photo over 10 MB on Android" → Android photo upload crash
- "can you please help me, the checkout button does nothing" → Checkout button does nothing
- "add dark mode to the settings page" → Dark mode in settings
- "el buscador de productos no encuentra nada con acentos" → Buscador falla con acentos
- "el login con Facebook no funciona en Firefox" → Login de Facebook en Firefox
- 1. "fix the bug" 2. "the Excel export cuts off the dates" → Excel export cuts dates
- 1. "mira el PR 431" 2. "el carrito se vacía al volver atrás en el iPhone" → Carrito se vacía en iPhone

Reply with the name alone.
