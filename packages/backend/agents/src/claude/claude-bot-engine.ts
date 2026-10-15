import { mkdir } from 'node:fs/promises';
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { BotEngine, type BotEngineEvent, type BotTurnRequest } from '../bot-engine';
import { describeError, guardTurn } from '../turn';
import { ClaudeEventTranslator } from './claude-events';
import { claudeOptions, scratchDirs } from './claude-options';
import { createToolServer } from './claude-tool-server';

/** One running query: its messages, and how to stop its subprocess. */
export interface ClaudeRun extends AsyncIterable<SDKMessage> {
  close?(): void;
}

/** Starts a query. The SDK's `query` in production; a scripted stream in tests. */
export type ClaudeQuery = (params: { prompt: string; options: Options }) => Promise<ClaudeRun>;

const sdkQuery: ClaudeQuery = async (params) => {
  // Loaded on the first turn, so importing the package starts nothing.
  const { query } = await import('@anthropic-ai/claude-agent-sdk');
  return query(params);
};

const STDERR_TAIL = 2_000;

/**
 * Providers `anthropic` and `glm`, on the Claude Agent SDK: Claude Code as
 * a library, run as a subprocess per turn with its shell and file tools off
 * and our tools served to it in process.
 */
export class ClaudeBotEngine extends BotEngine {
  constructor(private readonly query: ClaudeQuery = sdkQuery) {
    super();
  }

  run(request: BotTurnRequest): AsyncIterable<BotEngineEvent> {
    return guardTurn(request, () => this.stream(request));
  }

  private async *stream(request: BotTurnRequest): AsyncGenerator<BotEngineEvent> {
    const dirs = scratchDirs(request.scratchDir);
    await Promise.all(
      [dirs.configDir, dirs.cwd, dirs.tmp].map((dir) => mkdir(dir, { recursive: true })),
    );

    let run: ClaudeRun | undefined;
    const close = () => {
      try {
        run?.close?.();
      } catch {
        // Already closed.
      }
    };
    // Either one ends the subprocess; both, so that a stream waiting on a
    // model that never answers is not what decides when it dies.
    const abortController = new AbortController();
    const abort = () => {
      abortController.abort();
      close();
    };
    request.signal.addEventListener('abort', abort, { once: true });

    let stderr = '';
    const onStderr = (data: string) => {
      stderr = (stderr + data).slice(-STDERR_TAIL);
    };
    const translator = new ClaudeEventTranslator();
    const toolServer = createToolServer(request.tools, abortController.signal);
    try {
      run = await this.query({
        prompt: request.message,
        options: claudeOptions(request, dirs, toolServer, abortController, onStderr),
      });
      if (request.signal.aborted) close();
      for await (const message of run) {
        yield* translator.translate(message);
      }
      yield* translator.finish(stderr.trim() || undefined);
    } catch (error) {
      if (request.signal.aborted) throw error;
      // The subprocess's last words say why it exited; the SDK's error only that it did.
      const detail = stderr.trim();
      throw new Error(detail ? `${describeError(error)}: ${detail}` : describeError(error));
    } finally {
      request.signal.removeEventListener('abort', abort);
      close();
      abortController.abort();
      await toolServer.close().catch(() => undefined);
    }
  }
}
