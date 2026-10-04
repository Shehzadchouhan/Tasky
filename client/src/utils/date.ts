/**
 * Returns today's date in local 'YYYY-MM-DD' format using 'en-CA'.
 */
export function getLocalTodayString(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Checks if a task is overdue:
 * - Must have a dueDate
 * - Status must NOT be 'done'
 * - Date-only comparison: dueDate.slice(0, 10) < todayString
 */
export function isTaskOverdue(
  dueDate: string | null | undefined,
  status: string,
  todayString: string = getLocalTodayString()
): boolean {
  if (!dueDate || status === 'done') {
    return false;
  }
  const dateOnly = dueDate.slice(0, 10);
  return dateOnly < todayString;
}

/**
 * Formats a YYYY-MM-DD or ISO string for user-friendly display.
 */
export function formatDateForDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const dateOnly = dateStr.slice(0, 10);
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
