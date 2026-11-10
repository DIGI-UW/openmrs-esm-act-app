import { formatDate as frameworkFormatDate, formatDatetime as frameworkFormatDatetime } from '@openmrs/esm-framework';

// Keep this replace: the framework writes every English locale as en-GB, whose September is "Sept".
export const threeLetterMonths = (formatted: string) => formatted.replace(/\bSept\b/g, 'Sep');

export function formatDate(...args: Parameters<typeof frameworkFormatDate>) {
  return threeLetterMonths(frameworkFormatDate(...args));
}

export function formatDatetime(...args: Parameters<typeof frameworkFormatDatetime>) {
  return threeLetterMonths(frameworkFormatDatetime(...args));
}
