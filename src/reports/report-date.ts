/**
 * A date column's value as reporting REST sends it: an ISO string, or a Java-style array with a 1-based
 * month. The date is read without its time or offset, so it shows the day the report recorded.
 */
export function parseReportDate(value: unknown): Date | null {
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value.map(Number);
    return new Date(year, month - 1, day);
  }
  const match = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}
