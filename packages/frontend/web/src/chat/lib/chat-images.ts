/** An image a chat message carries, as `ChatImageGallery` draws it. */
export interface ChatGalleryImage {
  key: string;
  /** Its file name, or what stands for one ("Pasted image"). */
  name: string;
  /** Where the bytes are; none while they load. */
  src?: string;
  /** The bytes could not be read: the tile says so and does not open. */
  failed?: boolean;
}
