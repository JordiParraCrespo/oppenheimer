/**
 * A bot's reply is Markdown; Slack reads its own mrkdwn. Bold is one asterisk
 * there, italics an underscore, and links are <url|text>.
 */
export function slackTextOf(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, '_$1_')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<$2|$1>');
}
