import { expect, test } from '@playwright/test';
import { expectProblemDocument, signedUpContext } from '../../support/auth';

/**
 * Images in a bot's chat through the deployed API
 * (`product/versions/mvp/25-bots.md` §3.1): an image is uploaded, judged by
 * its bytes, read back only through the bot, and sent once by naming it on a
 * message, which carries it in the conversation; a file that is not an image,
 * an image for a GLM bot, a message of nothing and a second send of one
 * image are each refused with their code. No model is called: the turn the
 * send queues runs on a placeholder key and may fail, which is not what this
 * proves.
 */

/** A 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const image = (name: string, buffer: Buffer, mimeType = 'image/png') => ({
  multipart: { file: { name, mimeType, buffer } },
});

test('an image is uploaded, read back, sent once with a message and kept in the chat', async () => {
  const { api } = await signedUpContext('botimages');
  expect(
    (
      await api.put('/api/v1/model-providers/anthropic', {
        data: { apiKey: 'sk-ant-e2e-placeholder-key' },
      })
    ).status(),
  ).toBe(204);
  const bot = (await (
    await api.post('/api/v1/bots', { data: { name: 'Vision Bot', provider: 'anthropic' } })
  ).json()) as { id: string };

  // A file that says it is a PNG but is text is judged by its bytes.
  await expectProblemDocument(
    await api.post(`/api/v1/bots/${bot.id}/attachments`, image('notes.png', Buffer.from('hello'))),
    { status: 415, code: 'BOTS_024' },
  );

  const uploaded = await api.post(`/api/v1/bots/${bot.id}/attachments`, image('dot.png', PNG));
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  const attachment = (await uploaded.json()) as { id: string };
  expect(attachment).toMatchObject({
    mimeType: 'image/png',
    sizeBytes: PNG.length,
    name: 'dot.png',
  });

  const content = await api.get(`/api/v1/bots/${bot.id}/attachments/${attachment.id}/content`);
  expect(content.status()).toBe(200);
  expect(content.headers()['content-type']).toContain('image/png');
  expect(Buffer.from(await content.body()).equals(PNG)).toBe(true);

  // Nothing at all is not a message.
  await expectProblemDocument(
    await api.post(`/api/v1/bots/${bot.id}/messages`, { data: { content: '' } }),
    { status: 400 },
  );
  const sent = await api.post(`/api/v1/bots/${bot.id}/messages`, {
    data: { content: '', attachmentIds: [attachment.id] },
  });
  expect(sent.status(), await sent.text()).toBe(202);
  const conversation = (await (await api.get(`/api/v1/bots/${bot.id}/conversation`)).json()) as {
    messages: { role: string; content: string; attachments: { id: string }[] }[];
  };
  expect(conversation.messages[0]).toMatchObject({
    role: 'user',
    content: '',
    attachments: [{ id: attachment.id }],
  });

  // An image is sent once.
  await expectProblemDocument(
    await api.post(`/api/v1/bots/${bot.id}/messages`, {
      data: { content: 'again', attachmentIds: [attachment.id] },
    }),
    { status: 409, code: 'BOTS_027' },
  );
  await api.dispose();
});

test('a bot whose model reads no images refuses them, and another workspace cannot read one', async () => {
  const { api } = await signedUpContext('botimagesglm');
  const glm = (await (await api.post('/api/v1/bots', { data: { provider: 'glm' } })).json()) as {
    id: string;
  };
  await expectProblemDocument(
    await api.post(`/api/v1/bots/${glm.id}/attachments`, image('dot.png', PNG)),
    { status: 422, code: 'BOTS_028' },
  );

  const vision = (await (
    await api.post('/api/v1/bots', { data: { provider: 'anthropic' } })
  ).json()) as { id: string };
  const attachment = (await (
    await api.post(`/api/v1/bots/${vision.id}/attachments`, image('dot.png', PNG))
  ).json()) as { id: string };
  const stranger = await signedUpContext('botimagesstranger');
  await expectProblemDocument(
    await stranger.api.get(`/api/v1/bots/${vision.id}/attachments/${attachment.id}/content`),
    { status: 404, code: 'BOTS_001' },
  );
  await stranger.api.dispose();
  await api.dispose();
});
