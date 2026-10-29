import {
  SESSION_FILE_TYPES,
  SESSION_TEXT_TYPES,
  type SessionFileMediaType,
} from '@oppenheimer/shared/protocol';

/** Where the agent is told to save the files, outside the checkout it works in. */
const DOWNLOAD_DIR = '/tmp/attachments';

/** One file of a cloud session's first task: where to download it, and what it is. */
export interface CloudTaskFile {
  url: string;
  mediaType: SessionFileMediaType;
}

/**
 * A cloud session's first task with its files: the text as typed, then one
 * `curl` line per file the agent can run as it stands, then how to read them.
 *
 * The cloud never sees the host the files would otherwise be saved on, so
 * they travel as links in the task, the one thing `claude --cloud` takes
 * (`product/next-steps/cloud-agents.md`, "Files for a cloud session"). Each is
 * saved under a name of its own (`1.png`, `2.pdf`), never one a person chose,
 * as the runner names a host session's files. No files is the task unchanged.
 */
export function cloudTaskWithFiles(prompt: string, files: readonly CloudTaskFile[]): string {
  if (files.length === 0) return prompt;
  const downloads = files.map(
    (file, i) =>
      `curl -fsSL --create-dirs -o ${DOWNLOAD_DIR}/${i + 1}${extensionOf(file.mediaType)} '${file.url}'`,
  );
  return [
    prompt,
    '',
    'Files attached to this task. Download them before you start (the links expire in a day), then open each with the Read tool:',
    ...downloads,
  ].join('\n');
}

function extensionOf(mediaType: SessionFileMediaType): string {
  const type = [...SESSION_FILE_TYPES, ...SESSION_TEXT_TYPES].find(
    (candidate) => candidate.mediaType === mediaType,
  );
  return type?.extension ?? '';
}
