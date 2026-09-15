import { ChatMarkdown } from '@oppenheimer/design-system-mobile/chat-markdown';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { ScrollView, View } from 'react-native';

const SAMPLE = `## Weekly summary

Traffic to **acme.com** is up 12% week on week, driven by the *pricing* page.

- 3 new backlinks from [example.org](https://example.org)
- 1 page dropped out of the top 10: \`/blog/old-post\`

1. Refresh the dropped post
2. Add internal links from the pricing page

> Nothing here needs approval yet.

\`\`\`json
{ "domain": "acme.com", "delta": 0.12 }
\`\`\``;

export default function ChatMarkdownScreen() {
  return (
    <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Assistant prose</Text>
        <View className="rounded-2xl border border-border-subtle bg-card p-4">
          <ChatMarkdown>{SAMPLE}</ChatMarkdown>
        </View>
      </View>
    </ScrollView>
  );
}
