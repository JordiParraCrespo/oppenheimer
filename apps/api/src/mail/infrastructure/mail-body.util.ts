import { htmlToText } from './gmail-message.util';

/**
 * A message's body as it goes out (`product/next-steps/mail.md` §3.4): what
 * the bot wrote, in light markdown, as plain text and as simple HTML, with
 * the answered or forwarded message quoted below it and the alias's Gmail
 * signature after, the way Gmail itself lays a reply out.
 */
export interface MailBody {
  text: string;
  html: string;
}

/** What the answered or forwarded message contributes below the new text. */
export interface QuotedMessage {
  kind: 'reply' | 'forward';
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
}

export function composeBody(
  written: string,
  options: { quoted: QuotedMessage | null; signatureHtml: string | null },
): MailBody {
  const texts = [written.trim()];
  const htmls = [markdownToHtml(written)];
  if (options.signatureHtml?.trim()) {
    texts.push(`-- \n${htmlToText(options.signatureHtml)}`);
    htmls.push(`<div class="gmail_signature">${options.signatureHtml}</div>`);
  }
  if (options.quoted) {
    const quoted = options.quoted;
    if (quoted.kind === 'reply') {
      const said = `On ${quoted.date || 'an earlier day'}, ${quoted.from} wrote:`;
      texts.push(
        `${said}\n${quoted.body
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')}`,
      );
      htmls.push(
        `<div class="gmail_quote"><div>${escapeHtml(said)}</div><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${textToHtml(quoted.body)}</blockquote></div>`,
      );
    } else {
      const head = [
        '---------- Forwarded message ---------',
        `From: ${quoted.from}`,
        ...(quoted.date ? [`Date: ${quoted.date}`] : []),
        `Subject: ${quoted.subject}`,
        `To: ${quoted.to}`,
        ...(quoted.cc ? [`Cc: ${quoted.cc}`] : []),
      ];
      texts.push(`${head.join('\n')}\n\n${quoted.body}`);
      htmls.push(
        `<div class="gmail_quote">${head.map(escapeHtml).join('<br>')}<br><br>${textToHtml(quoted.body)}</div>`,
      );
    }
  }
  return {
    text: texts.filter(Boolean).join('\n\n'),
    html: `<div dir="ltr">${htmls.filter(Boolean).join('<br>')}</div>`,
  };
}

/**
 * The light markdown a bot writes mail in, as HTML: paragraphs, line breaks,
 * `-`/`*` and `1.` lists, **bold**, *italic*, and `[text](https://…)` links.
 * Everything else is text, escaped: nothing a bot writes becomes markup of
 * its own.
 */
export function markdownToHtml(markdown: string): string {
  const blocks = markdown
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\s*\n/);
  return blocks
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
        return `<ol>${lines.map((line) => `<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

function inline(line: string): string {
  return escapeHtml(line)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, label: string, url: string) => `<a href="${url}">${label}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

function textToHtml(text: string): string {
  return escapeHtml(text.trim()).replace(/\n/g, '<br>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
