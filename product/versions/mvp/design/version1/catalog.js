// One source for names every composer shows: models, approval modes, bot templates.
// Bots, Plan and Pull requests read from here instead of baking names into frames.
window.OP_CATALOG = {
  models: [
    { k: 'opus', name: 'Claude Opus 4.6', vendor: 'Anthropic' },
    { k: 'sonnet', name: 'Claude Sonnet 4.6', vendor: 'Anthropic' },
    { k: 'haiku', name: 'Claude Haiku 4.5', vendor: 'Anthropic' },
    { k: 'codex', name: 'GPT-5.2 Codex', vendor: 'OpenAI' },
    { k: 'gpt', name: 'GPT-5.2', vendor: 'OpenAI' },
  ],
  defaultModel: 'sonnet',
  approvals: [
    { k: 'ask', icon: 'shield', label: 'Ask for approval', desc: 'Pause before every edit and command.' },
    { k: 'edit', icon: 'file-text', label: 'Auto-edit', desc: 'Edit files freely; ask before running commands.' },
    { k: 'full', icon: 'alert-triangle', label: 'Full access', desc: 'Edits and commands run without asking.' },
  ],
  templates: [
    { k: 'blank', icon: 'bot', name: 'Blank', botName: 'New Bot', desc: 'Describe the job and it writes its own instructions.', role: 'No instructions yet', hello: 'What would you most like help with? Tell me the job and I will write my own instructions from it.' },
    { k: 'github', icon: 'git-pull-request', name: 'GitHub', botName: 'GitHub Bot', desc: 'Reviews and lands pull requests. Pull requests stay on.', role: 'Reviews and lands pull requests', hello: 'I review and land pull requests. Which repositories should I watch, and do I merge on green or ask first?' },
    { k: 'sessions', icon: 'terminal', name: 'Sessions', botName: 'Sessions Bot', desc: 'Starts and watches terminal sessions on your hosts.', role: 'Starts and watches sessions', hello: 'I start and watch terminal sessions. Which hosts may I use, and when should I stop a run?' },
    { k: 'plan', icon: 'check-circle', name: 'Plan', botName: 'Plan Bot', desc: 'Keeps tasks and milestones on the board current.', role: 'Keeps the Plan board current', hello: 'I keep the Plan board current. Which projects should I watch?' },
  ],
};
