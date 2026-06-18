import * as React from "react";

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Checkbox({ checked, onCheckedChange }: Props) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  );
}