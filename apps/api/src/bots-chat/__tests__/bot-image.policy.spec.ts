import { botHistory } from '../domain/bot-history.policy';
import { attachedImagesNote, imagesNote, withEarlierImages } from '../domain/bot-image.policy';

/**
 * Earlier images in the history a turn is sent: never the images, but a
 * line where they were with their ids, which tells a turn offered
 * `view_image` to look again with it and any other turn that it cannot see
 * them; a message of images alone still reads back, and the images the bot
 * showed are named, so it knows what it already put in front of the person.
 */
describe('withEarlierImages', () => {
  it('says where your earlier images were, image-only messages included', () => {
    const messages = [
      { role: 'user' as const, content: 'What is this?', attachments: [{ name: 'a.png' }] },
      { role: 'assistant' as const, content: 'A cat.', attachments: [] },
      { role: 'user' as const, content: '', attachments: [{ name: 'b.png' }, { name: 'c.png' }] },
    ];
    expect(
      botHistory(
        messages.map((message) => withEarlierImages(message, true)),
        null,
      ),
    ).toEqual([
      { role: 'user', text: `What is this?\n\n${imagesNote([{ name: 'a.png' }], true)}` },
      { role: 'assistant', text: 'A cat.' },
      { role: 'user', text: imagesNote([{ name: 'b.png' }, { name: 'c.png' }], true) },
    ]);
    expect(imagesNote([{ name: 'b.png' }, { name: 'c.png' }], true)).toContain('2 images');
  });

  it('names the images the bot showed, an image-only message of its own included', () => {
    const shown = withEarlierImages(
      {
        role: 'assistant',
        content: '',
        attachments: [{ name: 'Revenue by quarter' }, { name: 'logo.png' }],
      },
      true,
    );
    expect(botHistory([shown], null)).toEqual([
      {
        role: 'assistant',
        text: '[Oppenheimer: here you showed the person 2 images with show_image: "Revenue by quarter", "logo.png".]',
      },
    ]);
  });

  it('leaves a message without images as it was', () => {
    expect(withEarlierImages({ role: 'user', content: 'Hi', attachments: [] }, true)).toEqual({
      role: 'user',
      content: 'Hi',
      event: undefined,
      reaction: null,
      botReaction: null,
    });
  });

  it('gives the ids of the images a message carried, which a mail tool can still attach', () => {
    const image = { id: '7c2f0d2e-4c39-4d8e-9a11-0f5b2b6f1a10', name: 'receipt.png' };
    const earlier = withEarlierImages(
      { role: 'user', content: 'Send this', attachments: [image] },
      true,
    );

    expect(earlier.content).toContain(`"receipt.png" (image id ${image.id})`);
    expect(attachedImagesNote([image])).toContain(`image id ${image.id}`);
    expect(attachedImagesNote([image])).toContain('chat_image');
    expect(attachedImagesNote([])).toBe('');
  });

  // The incident: a note that said "ask the person to send it again" made a
  // bot do that for an image sent a moment earlier, when it could look again.
  it('tells a turn offered view_image to look again with it, never to ask for the image again', () => {
    const image = { id: '7c2f0d2e-4c39-4d8e-9a11-0f5b2b6f1a10', name: 'image.png' };
    const note = withEarlierImages(
      { role: 'user', content: '', attachments: [image] },
      true,
    ).content;

    expect(note).toContain('call view_image');
    expect(note).toContain(`(image id ${image.id})`);
    expect(note).not.toMatch(/ask the person to send/);
  });

  it('never names view_image on a turn that is not offered it', () => {
    const image = { id: '7c2f0d2e-4c39-4d8e-9a11-0f5b2b6f1a10', name: 'image.png' };
    const note = withEarlierImages(
      { role: 'user', content: '', attachments: [image] },
      false,
    ).content;

    expect(note).not.toContain('view_image');
    expect(note).toContain('ask the person to send it again');
    expect(note).toContain(`(image id ${image.id})`);
  });
});
