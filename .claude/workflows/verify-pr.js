export const meta = {
  name: 'verify-pr',
  description: 'Independently verify one pull request head: re-run the gates, drive the change live, audit the diff, return PASS / PASS+NOTES / FAIL / BLOCKED',
  whenToUse: 'Step 4 of the ship skill, before any merge. args: { pr, head, lane, lanes? }',
  phases: [
    { title: 'Scope', detail: 'read the diff, name what to drive and what the fix restores' },
    { title: 'Verify', detail: 'gates then live on the stack; audit lenses in parallel' },
    { title: 'Refute', detail: 'one skeptic per audit finding' },
  ],
}

const REPO = 'JordiParraCrespo/oppenheimer'
const pr = args && args.pr
const head = args && args.head
const lane = (args && args.lane) || 'feature'
const only = args && args.lanes
if (!pr || !head) throw new Error('verify-pr needs args { pr, head }')
const KNOWN = ['gates', 'live', 'audit']
if (only !== undefined && (!Array.isArray(only) || !only.length || only.some((l) => !KNOWN.includes(l)))) {
  throw new Error(`args.lanes must be a non-empty subset of ${KNOWN.join(', ')}; got ${JSON.stringify(only)}`)
}
const runs = (name) => !only || only.includes(name)

const CHECKOUT = `You did not write this code; you are checking it. Work on pull request ${REPO}#${pr} at exactly ${head}:
\`git fetch origin pull/${pr}/head && git checkout --detach ${head}\`, then confirm \`git rev-parse HEAD\` prints ${head}. If it does not, report BLOCKED.`

const LANE = {
  type: 'object',
  properties: {
    verdict: { enum: ['PASS', 'ISSUES', 'BLOCKED'] },
    sha: { type: 'string', description: 'git rev-parse HEAD where the lane ran' },
    evidence: { type: 'array', items: { type: 'string' }, description: 'commands run with their outcome, screenshot paths, response bodies' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          repro: { type: 'string', description: 'how to see it fail' },
          blocking: { type: 'boolean', description: 'false for a note that should not stop the merge' },
          decision: { type: 'boolean', description: 'true when a person must decide, not a code fix' },
        },
        required: ['summary', 'repro', 'blocking', 'decision'],
      },
    },
  },
  required: ['verdict', 'sha', 'evidence', 'issues'],
}

const SCOPE = {
  type: 'object',
  properties: {
    surfaces: { type: 'array', items: { type: 'string' }, description: 'what to drive live: console routes, runner commands, endpoints' },
    claim: { type: 'string', description: 'the behavior the PR says it delivers or restores, in one sentence' },
    repro: { type: 'string', description: 'for a fix: the steps that showed the bug, from the PR or its failing test' },
  },
  required: ['surfaces', 'claim', 'repro'],
}

phase('Scope')
const scope = await agent(
  `${CHECKOUT}
Read the PR title, description and \`git diff origin/main...HEAD\`. Name every user-facing surface the change shows on (console routes, runner commands, API endpoints), the one behavior it claims, and, when it is a fix, the steps that reproduced the bug. Do not judge the code.`,
  { label: 'scope', phase: 'Scope', schema: SCOPE, effort: 'low' },
)
if (!scope) throw new Error('scope agent returned nothing')

phase('Verify')
const gates = () =>
  agent(
    `${CHECKOUT}
Run the gates the way the steward skill describes: \`pnpm install --frozen-lockfile\` if needed, then \`pnpm ci:local\` on this commit. Report each row of .ci-local/report.md as evidence. A red row is an ISSUES entry with its failing output as repro. Never use --skip.`,
    { label: 'gates', phase: 'Verify', schema: LANE, isolation: 'worktree' },
  )

const live = () =>
  agent(
    `${CHECKOUT}
Prove the change on the real surface, following the local-stack skill: stand the stack up (with --web when a console route is involved), then drive each surface the way a user would:
${scope.surfaces.map((s) => `- ${s}`).join('\n')}
The claim to prove: ${scope.claim}
${lane === 'fix' ? `It is a fix. First check the bug's repro on origin/main fails (${scope.repro}), then that it passes on ${head}. Both results are evidence.` : ''}
Capture the action and the resulting state (screenshots light and dark for the console, terminal output, response bodies) and list their paths. Use real user paths, never test-only endpoints. Tear the stack down after, keeping the evidence. If the stack cannot start, report BLOCKED with the error, never PASS.`,
    { label: 'live', phase: 'Verify', schema: LANE, isolation: 'worktree' },
  )

const LENSES = [
  {
    key: 'correctness',
    brief: 'Find bugs this diff introduces: wrong results, unhandled states, races, regressions in callers of changed code. Trace each from a real caller or input. Ignore style.',
  },
  {
    key: 'rules',
    brief: 'Check the diff against the repo rules that govern the touched paths (.agents/rules/*, the AGENTS.md beside each file): architecture boundaries, error catalog, scopes on endpoints, translations, tests at the owner boundary. Report only a broken rule you can cite.',
  },
  {
    key: 'lane',
    brief: `The PR is in the "${lane}" lane. Read "## 2. Pick the lane" and "## Always ask" in .agents/skills/ship/SKILL.md: they are the only statement of the lane rules. Report as a decision (blocking false, decision true) each rule there that puts this PR in a different lane, citing the rule. Report any security concern as blocking.`,
  },
]

const audit = (lens) =>
  agent(
    `${CHECKOUT}
Audit \`git diff origin/main...HEAD\` through one lens. ${lens.brief}
Report ISSUES with every one you can show, PASS when there are none. Read-only: change no file.`,
    { label: `audit:${lens.key}`, phase: 'Verify', schema: LANE },
  )

const REFUTED = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    why: { type: 'string', description: 'the code path or command output that decides it' },
  },
  required: ['refuted', 'why'],
}

const refute = (issue, lens) =>
  agent(
    `${CHECKOUT}
An auditor (${lens}) claims: "${issue.summary}" (${issue.file || 'no file'}${issue.line ? `:${issue.line}` : ''}). Repro given: ${issue.repro}
Try to refute it against the code at HEAD: run the repro or trace the path. refuted=true when the claim is wrong or already handled; default to refuted=false only when you showed it holds.`,
    { label: `refute:${lens}`, phase: 'Refute', schema: REFUTED, effort: 'medium' },
  )

const tasks = []
if (runs('gates') || runs('live')) {
  tasks.push(async () => {
    const out = []
    if (runs('gates')) out.push({ lane: 'gates', result: await gates() })
    if (runs('live')) out.push({ lane: 'live', result: await live() })
    return out
  })
}
for (const lens of LENSES) {
  if (!runs('audit')) break
  tasks.push(async () => {
    const result = await audit(lens)
    if (!result || result.verdict !== 'ISSUES') return [{ lane: `audit:${lens.key}`, result }]
    const judged = await parallel(result.issues.map((i) => () => refute(i, lens.key).then((v) => ({ ...i, refutation: v }))))
    const kept = judged.filter(Boolean).filter((i) => !(i.refutation && i.refutation.refuted))
    return [{ lane: `audit:${lens.key}`, result: { ...result, verdict: kept.length ? 'ISSUES' : 'PASS', issues: kept } }]
  })
}

const expected = [
  ...['gates', 'live'].filter(runs),
  ...(runs('audit') ? LENSES.map((l) => `audit:${l.key}`) : []),
]
const ran = (await parallel(tasks)).filter(Boolean).flat()
// A lane whose task died never reports; it is a gap, not a pass.
const lanes = expected.map((name) => ran.find((l) => l.lane === name) || { lane: name, result: null })

const gaps = lanes.filter((l) => !l.result || l.result.verdict === 'BLOCKED' || l.result.sha !== head)
const issues = lanes.flatMap((l) => (l.result && l.result.verdict === 'ISSUES' ? l.result.issues.map((i) => ({ lane: l.lane, ...i })) : []))
const blocking = issues.filter((i) => i.blocking && !i.decision)
const decisions = issues.filter((i) => i.decision)

let verdict = 'PASS'
if (gaps.length) verdict = 'BLOCKED'
else if (blocking.length) verdict = 'FAIL'
else if (issues.length) verdict = 'PASS+NOTES'
if (gaps.length) log(`gaps: ${gaps.map((g) => g.lane).join(', ')} — a missing lane is never a pass`)

return {
  pr,
  head,
  lane,
  verdict,
  partial: Boolean(only),
  needsPerson: decisions.length > 0,
  claim: scope.claim,
  lanes: lanes.map((l) => ({ lane: l.lane, verdict: l.result ? l.result.verdict : 'BLOCKED', sha: l.result && l.result.sha, evidence: l.result ? l.result.evidence : [] })),
  blocking,
  decisions,
  notes: issues.filter((i) => !i.blocking && !i.decision),
}
