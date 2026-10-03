import { screen } from '@testing-library/react';

/** Each column's label as shown, without the instructions Carbon reads out on a sortable header. */
export const columnHeaders = () =>
  screen
    .getAllByRole('columnheader')
    .map((header) => header.querySelector('.cds--table-header-label')?.textContent ?? header.textContent);
