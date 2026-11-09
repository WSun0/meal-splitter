/**
 * One color per person, by their position in the diner list. The same index
 * is used on every screen and on the shared page, so Will is the same color
 * from Diners through Assign to the link his friends open.
 *
 * Picked to read on the paper background and hold white initials (all pass
 * WCAG AA for large text against #fff).
 */
export const PERSON_COLORS = [
  '#3d6bf0', // blue
  '#d63f73', // pink
  '#b9770a', // amber
  '#7a4bd9', // violet
  '#0b877b', // teal
  '#cf4f28', // vermilion
  '#4c6a88', // slate
  '#a2418a', // plum
  '#55831c', // olive
  '#2a84bd', // sky
] as const;

export function personColor(index: number): string {
  const i = ((index % PERSON_COLORS.length) + PERSON_COLORS.length) % PERSON_COLORS.length;
  return PERSON_COLORS[i];
}
