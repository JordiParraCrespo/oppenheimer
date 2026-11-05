/**
 * The image the reader lays behind New session, kept on this device like the
 * sidebar's folds: a picture is the reader's taste, not the workspace's, so
 * the API never hears of it. It is stored as a data URL, downscaled first so a
 * photo straight off a camera fits in localStorage's few megabytes.
 */
const NEW_SESSION_BACKGROUND_KEY = 'oppenheimer.newSession.background';

/** The longest edge kept: a 4K-wide pane still reads it sharp enough behind a composer. */
const MAX_EDGE = 2560;

/** Unreadable, missing, or storage switched off: no image. */
export function storedBackground(): string | null {
  try {
    const stored = window.localStorage.getItem(NEW_SESSION_BACKGROUND_KEY);
    return stored?.startsWith('data:image/') ? stored : null;
  } catch {
    return null;
  }
}

/** Whether it was kept: a full quota or private browsing keeps it until the page reloads. */
export function rememberBackground(image: string | null): boolean {
  try {
    if (image) window.localStorage.setItem(NEW_SESSION_BACKGROUND_KEY, image);
    else window.localStorage.removeItem(NEW_SESSION_BACKGROUND_KEY);
    return true;
  } catch {
    return false;
  }
}

/** The size `width` × `height` is drawn at so its longest edge is at most `max`. */
export function fitWithin(width: number, height: number, max = MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * `file` as a JPEG data URL no larger than `MAX_EDGE` on its longest side.
 * Rejects what the browser cannot decode as an image.
 */
export async function backgroundFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not an image');
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    bitmap.close();
  }
}
