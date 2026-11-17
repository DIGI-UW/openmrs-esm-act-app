import { vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { useLayoutType } from '@openmrs/esm-framework';

/** The table sizes O3 gives each layout: compact rows on a desktop, large rows on a tablet. */
export const layouts = [
  { layout: 'small-desktop', compact: true, size: 'sm' },
  { layout: 'tablet', compact: false, size: 'lg' },
] as const;

export function setLayout(layout: (typeof layouts)[number]['layout']) {
  vi.mocked(useLayoutType).mockReturnValue(layout);
}

/** The loading table skeleton, found as O3's tests find it, with its body's row and column counts. */
export function tableSkeleton() {
  const skeleton = screen.getByRole('progressbar');
  const [, body] = within(skeleton).getAllByRole('rowgroup');
  const rows = within(body).getAllByRole('row');
  return { skeleton, rows: rows.length, columns: within(rows[0]).getAllByRole('cell').length };
}
