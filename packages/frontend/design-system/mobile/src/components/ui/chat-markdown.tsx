import * as React from 'react';
import { Linking, View } from 'react-native';
import { cn } from '../../lib/utils';
import { Text } from './text';

/**
 * Safe assistant prose.
 *
 * The web component hands the string to `react-markdown`; there is no React
 * Native port of that pipeline worth its weight, so this is a small renderer
 * for the Markdown a model actually writes — headings, paragraphs, bullet and
 * numbered lists, block quotes, fenced code — with bold, italic, inline code
 * and links inside. Everything is built as `Text` nodes: there is no HTML
 * path, so the model can use normal Markdown without gaining a way to inject
 * markup. Tables and images fall through as plain text rather than pretending.
 */
function ChatMarkdown({ children, className }: { children: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(children), [children]);

  return (
    <View className={cn('min-w-0 gap-3', className)}>
      {blocks.map((block, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no identity beyond position
        <Block key={index} block={block} />
      ))}
    </View>
  );
}

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

function parseBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i] ?? '')) {
        code.push(lines[i] ?? '');
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]?.length === 1 ? 1 : heading[1]?.length === 2 ? 2 : 3,
        text: heading[2] ?? '',
      });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        quote.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }

    const bullet = /^\s*[-*+]\s+/;
    const number = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || number.test(line)) {
      const ordered = number.test(line);
      const marker = ordered ? number : bullet;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(marker, ''));
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^```|^#{1,3}\s|^>\s?/.test(lines[i] ?? '') &&
      !bullet.test(lines[i] ?? '') &&
      !number.test(lines[i] ?? '')
    ) {
      paragraph.push((lines[i] ?? '').trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function Block({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <Text
          role="heading"
          aria-level={String(block.level)}
          className={cn(
            'font-semibold text-ink-900',
            block.level === 1 ? 'text-lg' : block.level === 2 ? 'text-base' : 'text-sm',
          )}
        >
          <Inline text={block.text} />
        </Text>
      );
    case 'quote':
      return (
        <View className="border-l-2 border-border-subtle pl-3">
          <Text className="text-base text-ink-600">
            <Inline text={block.text} />
          </Text>
        </View>
      );
    case 'code':
      return (
        <View className="max-w-full rounded-md bg-surface-sunken p-3">
          <Text className="font-mono text-sm text-ink-900">{block.text}</Text>
        </View>
      );
    case 'list':
      return (
        <View className="gap-1 pl-1">
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: items have no identity beyond position
            <View key={index} className="flex-row gap-2">
              <Text className="w-5 text-right text-base text-ink-600">
                {block.ordered ? `${index + 1}.` : '•'}
              </Text>
              <Text className="min-w-0 flex-1 text-base text-ink-900">
                <Inline text={item} />
              </Text>
            </View>
          ))}
        </View>
      );
    default:
      return (
        <Text className="text-base leading-normal text-ink-900">
          <Inline text={block.text} />
        </Text>
      );
  }
}

/** Bold, italic, inline code and links. Unmatched markers are left as text. */
const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/;

function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE).filter((part) => part !== '');

  return (
    <>
      {parts.map((part, index) => {
        // biome-ignore lint/suspicious/noArrayIndexKey: runs have no identity beyond position
        const key = index;
        if (/^(\*\*|__)/.test(part)) {
          return (
            <Text key={key} className="font-semibold">
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('`')) {
          return (
            <Text key={key} className="rounded-sm bg-surface-sunken px-1 font-mono text-sm">
              {part.slice(1, -1)}
            </Text>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
        if (link) {
          const href = link[2] ?? '';
          return (
            <Text
              key={key}
              role="link"
              className="text-accent-blue underline"
              onPress={() => {
                if (/^https?:\/\//.test(href)) Linking.openURL(href);
              }}
            >
              {link[1]}
            </Text>
          );
        }
        if (/^[*_]/.test(part) && part.length > 2) {
          return (
            <Text key={key} className="italic">
              {part.slice(1, -1)}
            </Text>
          );
        }
        return part;
      })}
    </>
  );
}

export { ChatMarkdown };
