import { botHistory } from '../domain/bot-history.policy';
import { imagesNote, withEarlierImages } from '../domain/bot-image.policy';

/**
 * Earlier images in the history a turn is sent: never the images, but a
 * line where they were, so the bot knows it cannot see them now; a message
 * of images alone still reads back.
 */
describe('withEarlierImages', () => {
  it('says where your earlier images were, image-only messages included', () => {
    const messages = [
      { role: 'user' as const, content: 'What is this?', attachments: [{}] },
      { role: 'assistant' as const, content: 'A cat.', attachments: [] },
      { role: 'user' as const, content: '', attachments: [{}, {}] },
    ];
    expect(botHistory(messages.map(withEarlierImages), null)).toEqual([
      { role: 'user', text: `What is this?\n\n${imagesNote(1)}` },
      { role: 'assistant', text: 'A cat.' },
      { role: 'user', text: imagesNote(2) },
    ]);
    expect(imagesNote(2)).toContain('2 images');
  });

  it('leaves a message without images as it was', () => {
    expect(withEarlierImages({ role: 'user', content: 'Hi', attachments: [] })).toEqual({
      role: 'user',
      content: 'Hi',
      event: undefined,
    });
  });
});
