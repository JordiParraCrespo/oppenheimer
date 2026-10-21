import { mkdir } from 'node:fs/promises';
import type { Query, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { BotEngine, type BotEngineEvent, type BotTurnRequest } from '../bot-engine';
import { describeError, guardTurn, ToolCallData } from '../turn';
import { ClaudeEventTranslator } from './claude-events';
import { claudeOptions, scratchDirs } from './claude-options';
import { createToolServer } from './claude-tool-server';

const STDERR_TAIL = 2_000;

type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

/**
 * The turn's message as Claude Code takes it: the text alone, or, with
 * images, one user message of image blocks then the text, the order
 * Anthropic recommends. The stream ends after it; the SDK keeps the
 * subprocess's input open until the turn's result, for our tool server.
 */
function claudePrompt(request: BotTurnRequest): string | AsyncIterable<SDKUserMessage> {
  const images = request.images ?? [];
  if (images.length === 0) return request.message;
  const message: SDKUserMessage = {
    type: 'user',
    parent_tool_use_id: null,
    message: {
      role: 'user',
      content: [
        ...images.map((image) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: image.mimeType as ImageMediaType,
            data: image.data,
          },
        })),
        ...(request.message ? [{ type: 'text' as const, text: request.message }] : []),
      ],
    },
  };
  return (async function* () {
    yield message;
  })();
}

/**
 * Providers `anthropic` and `glm`, on the Claude Agent SDK: Claude Code as
 * a library, run as a subprocess per turn with its shell and file tools off
 * and our tools served to it in process.
 */
export class ClaudeBotEngine extends BotEngine {
  run(request: BotTurnRequest): AsyncIterable<BotEngineEvent> {
    return guardTurn(request, () => this.stream(request));
  }

  private async *stream(request: BotTurnRequest): AsyncGenerator<BotEngineEvent> {
    const dirs = scratchDirs(request.scratchDir);
    await Promise.all(
      [dirs.configDir, dirs.cwd, dirs.tmp].map((dir) => mkdir(dir, { recursive: true })),
    );

    // The turn's one stop signal: the caller's abort, or this stream ending
    // however it ends. Its only effect is to close the query, which ends the
    // subprocess; `guardTurn` reports `cancelled` without waiting for it.
    const ended = new AbortController();
    const signal = AbortSignal.any([request.signal, ended.signal]);
    let run: Query | undefined;
    const close = () => {
      try {
        run?.close();
      } catch {
        // Already closed.
      }
    };
    signal.addEventListener('abort', close, { once: true });

    let stderr = '';
    const onStderr = (data: string) => {
      stderr = (stderr + data).slice(-STDERR_TAIL);
    };
    const made = new ToolCallData();
    const translator = new ClaudeEventTranslator(made);
    const toolServer = createToolServer(request.tools, { signal, apiKey: request.apiKey }, made);
    try {
      // Loaded on the first turn, so importing the package starts nothing.
      const { query } = await import('@anthropic-ai/claude-agent-sdk');
      run = query({
        prompt: claudePrompt(request),
        options: claudeOptions(request, dirs, toolServer, onStderr),
      });
      if (signal.aborted) close();
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
      ended.abort();
      await toolServer.close().catch(() => undefined);
    }
  }
}
