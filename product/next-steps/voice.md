# Voice — set up sessions by talking

**Goal:** Wispr Flow inside the console. Hold a key or tap the mic, say
what you want, and get clean text where the cursor is. Then go one step
further than dictation: speak a whole session ("on the Mac Studio, in
oppenheimer, a new branch off main, Claude on high effort: fix the
login redirect loop") and see the new-session form filled in, ready to
send.

Version not set; the first open question below is where it lands.

## What exists to build on

- **The new-session composer.** `apps/web/src/features/sessions/screens/new-session.tsx`
  is a page, not a dialog. Its sections pick project, host, agent,
  branch, effort and permission (`sections/new-session-*.tsx`), the
  form state is `hooks/use-new-session-form.ts`, and the prompt lives
  in `components/new-session-composer.tsx` as a `draft` string passed
  to the design-system `Composer`. Dictation writes into that `draft`.
- **The create contract.** `CreateSessionInput`
  (`packages/shared/src/schemas/session.schema.ts`) carries `hostId`,
  `agent`, `projectId`, `name`, `checkouts`, `launch`, `prompt` and
  `attachmentIds`. `POST /v1/sessions` (`sessions:write`, an
  Idempotency-Key) names the session from the prompt and the runner
  passes the prompt to the agent as its first task. A voice-filled form
  ends in this same call; nothing on the runner changes.
- **Tasks start sessions too.** The Plan board's start-session dialog
  (`apps/web/src/features/tasks/dialogs/start-session.tsx`) has a plain
  prompt `Textarea`, and the board has its own `TaskComposer`. Both are
  more places to dictate into.
- **The terminal input path.** Keystrokes go `term.onData` →
  `SessionStream.send` (`packages/frontend/consumer/src/modules/sessions/stream/session-stream.ts`)
  → a binary frame on the relay or the direct path. A transcript sent
  as one bracketed paste (`ESC[200~ … ESC[201~`) reaches Claude Code in
  a running session as if pasted.
- **A mic bar that nothing uses yet.** The design system already ships
  `VoiceRecorderBar` (`packages/frontend/design-system/web/src/components/chat-composer-extras.tsx`)
  with `waiting | recording | transcribing` states, a waveform and
  cancel and stop buttons.
- **An LLM seam.** `@oppenheimer/backend-llm` is a pluggable
  `LlmService.complete()` over Anthropic and OpenAI-compatible providers.
  It does text only, so it can clean up a transcript and parse it into a
  form, but it cannot transcribe.
- **What blocks it today.** `apps/web/nginx.conf` sends
  `Permissions-Policy: microphone=()`, which makes `getUserMedia` fail.
  No code in the repository records or transcribes audio yet.

## How it works

The pipeline has three steps. Only the first is new technology; the
other two are prompts over the existing LLM seam. The voice module owns
the first two and knows nothing about sessions. The third belongs to
the sessions module and takes any text, typed or dictated.

```
browser                       control plane (apps/api)                  providers
───────                       ────────────────────────                  ─────────
hold key / tap mic
MediaRecorder (webm/opus) ──▶ POST /v1/voice/transcriptions ─────────▶ speech-to-text
VoiceRecorderBar levels         1. transcribe   (audio in memory only)    (Whisper-class)
                                2. polish       LlmService ────────────▶ LLM
text into the prompt  ◀──────── { text, raw }
new-session form ─────────────▶ POST /v1/sessions/proposals
                                3. intent       LlmService ────────────▶ LLM
suggested setup       ◀──────── { proposal }
user reviews ── send ─────────▶ POST /v1/sessions (unchanged)
```

1. **Transcribe.** The browser records with `MediaRecorder` (Opus in
   WebM, or MP4/AAC on Safari) and uploads the clip once you stop. The
   API holds it in memory, sends it to a speech-to-text provider and
   drops it; audio is never written to storage. The request carries a
   vocabulary hint built from what the workspace already knows: project
   and repository names, branch names, host names, and agent names
   ("Claude Code", "Codex"). That fixes most of the "oppenheimer" →
   "Oppenheimer" and "repo" → "Rico" errors before they happen.
2. **Polish (the Wispr Flow step).** One short LLM pass turns speech
   into writing: it drops fillers and false starts, applies "no wait,
   actually…" self-corrections, punctuates, and formats code words
   (`useNewSessionForm`, `apps/web`, `fix/login-loop`) using the same
   vocabulary. It must not add content or answer the prompt. It is
   skipped when the raw transcript is already clean and short, and a
   "raw" toggle keeps the unpolished text one click away.
3. **Intent (setup from the prompt).** There is one mic, the
   composer's, and it always dictates into the prompt. On the
   new-session screen, once the prompt holds text that names a setup
   (dictated or typed), the form calls `POST /v1/sessions/proposals`
   with it. A structured-output LLM call in the sessions module reads
   the text with the caller's own hosts, projects, repositories, base
   branches and agents as closed lists, and returns a
   `VoiceSessionProposal`, a Zod schema in `packages/shared` shaped like
   the composer's draft rather than the wire:
   `{ hostId?, projectId?, repository?: { installationId, githubRepoId },
   baseBranch?, agent?, launch?: { model?, effort?, permission? },
   name?, prompt }`, with a confidence for each field. The console maps
   it onto the real contract: `repository` and `baseBranch` become the
   one `checkouts` entry (`installationId`, `githubRepoId`,
   `baseBranch`), and model, effort and permission go into `launch`.
   There is no working-branch field to fill, since a session's branch is
   always `oppenheimer/<slug>`. When no repository can be resolved (the
   named one is not in the list, or the project has no default), the
   repository picker stays empty and is flagged, and the send button
   stays disabled exactly as it does for a typed draft. The console
   fills the fields it is sure of, highlights the ones it guessed, and
   leaves the rest for you. The suggestions only fill fields still at
   their default, and one click undoes them. It never starts the
   session on its own: **you always press send.** "Start it" spoken at
   the end can focus the send button, nothing more.

### API

A new module `apps/api/src/voice/`, scaffolded with `/scaffold-module`:

- `POST /v1/voice/transcriptions`: multipart audio (60 s and 10 MB
  cap) and an optional `projectId` to narrow the vocabulary. It
  returns `{ text, raw }`, audio in and text out, whatever screen asked.
  It needs a new
  `voice:transcribe` scope in the scope catalog, the feature flag below
  (`@RequireFlag`), Swagger decorators, and a per-user rate limit.
- A port `SpeechToTextPort` with adapters on the pluggable pattern
  (abstract class → implementations → factory picked by env), the same
  shape as `@oppenheimer/backend-llm`. If a second app ever needs it, it
  moves into a `packages/backend/speech` package; until then it stays in
  the module.
  - **The workspace's ChatGPT sign-in** first (decided 2026-10-16).
    Settings → Model providers already signs a workspace in to ChatGPT
    for bots (`../versions/mvp/25-bots.md` §2), and
    `ChatgptCredentialResolver` in `apps/api/src/bots/` stores, seals
    and refreshes that sign-in. Voice reuses it rather than asking for a
    second credential. The bots module exports the resolver behind a
    small port (`ChatgptAccessPort`: access token and account id,
    refreshed), so the voice module never reads bots' tables. The adapter
    posts the clip as multipart to ChatGPT's own dictation route,
    `https://chatgpt.com/backend-api/transcribe`, the one the Codex CLI's
    push-to-talk uses: the access token as bearer, `chatgpt-account-id`,
    and `originator: oppenheimer`, the same honest identity the ChatGPT
    bot engine sends. The backend picks the speech model; the route
    takes no model and, as far as known clients show, no vocabulary
    prompt, so the vocabulary hint moves wholly into the polish step.
    - **What this trades.** The route is internal and undocumented. It
      can change or vanish without notice, it rejects API keys, it has
      answered some clients with a Cloudflare challenge, and it spends
      the subscription's own allowance. Slice 0 checks that it answers a
      server that says who it is. If it only answers clients that pose
      as the Codex app, that is a stop: Oppenheimer does not impersonate
      another client, and the key adapter below takes over.
    - **Failure is visible.** A refusal or a changed response maps to
      `VOICE_PROVIDER_UNAVAILABLE`; a lapsed sign-in maps to the same
      "sign in again in Settings → Model providers" the bots use.
  - **OpenAI-compatible `/audio/transcriptions`**, with a key, as the
    fallback and for deployments with no sign-in. One adapter covers
    OpenAI (`gpt-4o-mini-transcribe`, `gpt-4o-transcribe`), Groq
    (`whisper-large-v3-turbo`) and a self-hosted `faster-whisper` or
    `whisper.cpp` server, by base URL.
  - **Which one runs** is decided per workspace on each request: its
    ChatGPT sign-in when it has one, else the deployment's key, else
    `none`.
  - **`none`**: the mic is hidden. This is the default when no key is
    set, so a fresh clone still boots (the same rule as OAuth in
    `api-config.md`).
  - **Streaming** (Deepgram, AssemblyAI, or OpenAI realtime) comes
    later, behind the same port, if words appearing while you talk turn
    out to matter.
- Every provider call goes through `UpstreamLimiter.exchange` with
  buckets for what the provider counts (requests per minute, audio
  seconds per hour), plus a `429` error code of its own
  (`.agents/rules/integrations.md`).
- New error codes (`VOICE_AUDIO_TOO_LONG`, `VOICE_UNSUPPORTED_FORMAT`,
  `VOICE_PROVIDER_UNAVAILABLE`, `VOICE_RATE_LIMITED`) get rows in
  `apps/docs/docs/errors.md`.
- Env, for the fallback only: `VOICE_STT_BASE_URL`, `VOICE_STT_API_KEY`
  and `VOICE_STT_MODEL` in the root `.env.example`, each with a note.
  The ChatGPT path needs no env beyond what bots already need (the
  provider key sealer).
- **Polish runs on the same sign-in.** With a ChatGPT sign-in, the
  polish call goes through ChatGPT's Codex backend with
  `BotEngine.complete` from `@oppenheimer/backend-agents`, the way bot
  conversation summaries do, so one sign-in covers both steps. Without
  one it uses `LlmService`.
- The intent step is not in this module: it is
  `POST /v1/sessions/proposals` (text in, `{ proposal }` out,
  `sessions:write`) in `apps/api/src/sessions/`, which already knows the
  caller's hosts, projects, repositories and agents. It is useful
  without voice too: for a typed prompt, and later for Slack (0.4) and
  the MCP server (0.6).
- No new table for the first slice. A per-user dictionary (step 3)
  would be one small table, designed with `/design-database`.

### Console

- **A `voice` module** in `packages/frontend/consumer` holds the
  repository (`transcribe(blob, opts)`) and a TanStack mutation.
- **A `useDictation` hook** in the platform kit (`packages/frontend/web`,
  a new `voice/` concern) owns the browser side: `getUserMedia`,
  `MediaRecorder`, an `AnalyserNode` feeding the waveform levels,
  start/stop/cancel, and the permission states (prompt, denied, no
  device). It has no product imports, so any feature can use it.
- **A `DictateButton`** in the kit: the mic icon plus `VoiceRecorderBar`.
  It works by press-and-hold or click to toggle, and Esc cancels. It
  inserts the text at the caret, or replaces the selection.
- **Hotkey:** hold one key to talk anywhere a dictation target has
  focus, the way Wispr Flow uses Fn. The browser cannot see Fn, so the
  candidate is holding `Alt`+`Space`; the exact chord is an open
  question.
- **Targets, in order:** the new-session composer (with the setup
  suggestions it triggers), the task start-session dialog and the board's
  task composer, then the running-session terminal (a bracketed paste
  through `SessionStream.send`, never on read-only shared panes).
- **Plumbing:** `apps/web/nginx.conf` changes to `microphone=(self)`
  (the CSP needs nothing while audio goes through our API). New strings
  go in `packages/translations`. Every screen it touches gets light and
  dark screenshots (`/local-stack`).

### Flag, privacy, cost

- A `voice-dictation` flag in `packages/shared/src/feature-flags/catalog.ts`
  (a temporary release flag with an expiry), read with `useFeatureFlag`
  and `@RequireFlag`.
- **Privacy.** Three things leave the control plane, and the promise
  covers all three: the audio and the vocabulary hint go to the
  speech-to-text provider, and the transcript plus the closed lists go
  to the LLM provider for polish and intent. That happens even when you
  cancel instead of sending.
  - We store none of it: audio and transcripts are never written to
    storage or logs, and only the prompt you send is kept.
  - On the ChatGPT sign-in, both providers are OpenAI under the
    signed-in person's ChatGPT account, so that account's ChatGPT data
    controls apply rather than API retention terms. The first-use notice
    says so in those words.
  - Hosted providers are configured only under terms that exclude
    training and keep retention to the minimum they offer (zero data
    retention where the account has it). The slice 0 spike records
    each provider's actual retention, and the note states it instead
    of "never stored" when a provider keeps data for abuse monitoring.
    The self-hosted server is the option with no third party at all.
  - The vocabulary is scoped to what the caller can already see in the
    workspace, capped in size, and narrowed to the selected project
    when there is one. It never includes secrets or file contents.
  - The first time the mic is used, the console names both providers,
    what each receives (audio and names to one, text and names to the
    other) and their retention, and you accept before recording.
    Polish and intent can be switched off, which sends nothing to the
    LLM provider.
- **Cost.** At Whisper-class prices (about $0.006 per minute, less on
  Groq) plus one small LLM call, a 20-second prompt costs well under a
  cent. The limiter's per-user bucket is what caps abuse.
  On the ChatGPT sign-in there is no per-minute bill: dictation draws
  on the subscription's own limits, and a limit reached is a
  `VOICE_RATE_LIMITED` with the reset ChatGPT names.

## Slices

| # | Slice | Ships | Done when |
|---|-------|-------|-----------|
| 0 | Spike (1–2 days) | `microphone=(self)`; record in Chrome, Safari and Firefox; the ChatGPT sign-in adapter behind a hidden endpoint, called with `originator: oppenheimer`; whether the route answers it at all; measured latency for a 15 s clip on it vs OpenAI with a key; 20 real prompts scored raw vs polished | The ChatGPT route works without posing as another client, or the key fallback is chosen with numbers, and stop-to-text is under ~1.5 s at p50 |
| 1 | Dictate the prompt | The `voice` module (transcribe and polish), `useDictation`, `DictateButton` in the new-session composer, the flag, the scope, the error codes, screenshots | You can speak a prompt into a new session and send it |
| 2 | Set up from the prompt | `POST /v1/sessions/proposals` in the sessions module, the intent extraction with closed lists, the form prefilled with guesses highlighted | Most fields come out right on a set of spoken setups (the eval below) |
| 3 | Dictate everywhere | Task dialog, task composer, terminal paste, the hold-to-talk hotkey, a personal dictionary (words and replacements) | Talking to a running agent works the way the composer does |
| 4 | Later | Streaming partials; mobile/PWA (0.5) where voice beats a phone keyboard; Slack voice notes (0.4); a runner-side `whisper.cpp` so audio never leaves your host | — |

## How we know it works

- **Unit:** the `useDictation` state machine with a fake
  `MediaRecorder`; handler tests for the command with a fake
  `SpeechToTextPort` and `LlmService` (`testing-backend.md`).
- **Adapter:** the ChatGPT adapter against a recorded response,
  including a refused token (sign in again) and a changed response shape
  (`VOICE_PROVIDER_UNAVAILABLE`, never a crash); the OpenAI-compatible
  adapter against a recorded HTTP
  fixture, including a `429` that pauses the bucket.
- **e2e:** Playwright can feed Chromium a fake microphone
  (`--use-file-for-fake-audio-capture` with a WAV in `e2e/fixtures`)
  while the API uses a deterministic stub provider. That covers the
  path from speaking to the prompt in the composer to session created.
- **Eval:** about 30 recorded setups (several speakers and accents,
  Spanish and English) with the expected form, scored per field for
  intent and by word error rate for polish, kept next to the
  frontend-audit evals in `scripts/evals/voice/`. It reruns when a model
  or prompt changes.

## Questions to answer first

1. Which version does this land in? It is small enough to sit beside
   0.7 (terminal and chat), and it makes 0.5 (mobile) much better.
2. Languages: English only, or Spanish and Catalan as well? Whisper
   handles all three, but the polish prompt and the eval need each one.
3. Should it ever start the session without a click (say, hold the
   hotkey and finish with "go")? This note says no for now.
4. The ChatGPT route's terms: is a subscription's dictation route fair
   to call from a server for the person who signed in? The bots already
   make that call for the Codex backend; voice should follow whatever
   that decision is.
