export type NativeSegmentedProps = {
  labels: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
  testID?: string;
};
