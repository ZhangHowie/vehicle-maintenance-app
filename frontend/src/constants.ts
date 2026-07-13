export const FUEL_TYPE_OPTIONS = [
  { value: "P92", label: "92号汽油" },
  { value: "P95", label: "95号汽油" },
  { value: "P98", label: "98号汽油" },
  { value: "DIESEL", label: "柴油" },
  { value: "ELECTRIC", label: "电动" },
];

export function fuelTypeLabel(value: string): string {
  return FUEL_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
