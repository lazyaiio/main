/** Choices shown in the campaign form (kept free of heavy imports so the browser bundle stays small). */

export const DURATION_PRESETS = [7, 14, 30, 60, 90] as const;

/** Posting days use JavaScript numbering (0 = Sunday) but are shown starting on Monday. */
export const WEEKDAYS: { value: number; short: string; label: string }[] = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 0, short: "Sun", label: "Sunday" },
];

export const TIME_CHOICES: { value: string; label: string }[] = [
  { value: "08:00", label: "8:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "20:00", label: "8:00 PM" },
];
