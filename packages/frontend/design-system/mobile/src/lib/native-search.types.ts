export type NativeSearchProps = {
  /** Every change to the text, and `''` once when the field mounts. */
  onQueryChange: (query: string) => void;
  placeholder: string;
};
