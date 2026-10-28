import { botHistory } from '../domain/bot-history.policy';
import { imagesNote, withEarlierImages } from '../domain/bot-image.policy';

/**
 * Earlier images in the history a turn is sent: never the images, but a
 * line where they were, so the bot knows it cannot see them now; a message
 * of images alone still reads back, and the images the bot showed are named,
 * so it knows what it already put in front of the person.
 */
describe('withEarlierImages', () => {
  it('says where your earlier images were, image-only messages included', () => {
    const messages = [
      { role: 'user' as const, content: 'What is this?', attachments: [{ name: 'a.png' }] },
      { role: 'assistant' as const, content: 'A cat.', attachments: [] },
      { role: 'user' as const, content: '', attachments: [{ name: 'b.png' }, { name: 'c.png' }] },
    ];
    expect(botHistory(messages.map(withEarlierImages), null)).toEqual([
      { role: 'user', text: `What is this?\n\n${imagesNote(1)}` },
      { role: 'assistant', text: 'A cat.' },
      { role: 'user', text: imagesNote(2) },
    ]);
    expect(imagesNote(2)).toContain('2 images');
  });

  it('names the images the bot showed, an image-only message of its own included', () => {
    const shown = withEarlierImages({
      role: 'assistant',
      content: '',
      attachments: [{ name: 'Revenue by quarter' }, { name: 'logo.png' }],
    });
    expect(botHistory([shown], null)).toEqual([
      {
        role: 'assistant',
        text: '[Oppenheimer: here you showed the person 2 images with show_image: "Revenue by quarter", "logo.png".]',
      },
    ]);
  });

  it('leaves a message without images as it was', () => {
    expect(withEarlierImages({ role: 'user', content: 'Hi', attachments: [] })).toEqual({
      role: 'user',
      content: 'Hi',
      event: undefined,
    });
  });
});
