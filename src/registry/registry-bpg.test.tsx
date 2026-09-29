import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const withBpg = registryRows.map((row, i) => ({
  ...row,
  bpg_status: ['Covered', 'Not covered', 'Due soon'][i % 3],
  adherence: 50 + i,
}));

const bpgOn = { registry: { report: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890', showBpgColumns: true } };

describe('Registry BPG status and adherence', () => {
  beforeEach(() => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry');
    vi.mocked(useReportDataset).mockReturnValue({ columns: [], rows: withBpg, isLoading: false, error: undefined });
  });

  it('leaves the columns and the filter out while the setting is off', async () => {
    await signInWith(['View Patient Flags']);

    render(<Registry />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).not.toContain('BPG status');
    expect(headers).not.toContain('Adherence');
    expect(screen.queryByLabelText('BPG status')).not.toBeInTheDocument();
  });

  it('ignores a BPG status in the URL while the setting is off', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?bpg=Due+soon');
    await signInWith(['View Patient Flags']);

    render(<Registry />);

    expect(screen.getAllByRole('row')).toHaveLength(1 + 25);
  });

  it('leaves the adherence empty for a patient who has none', async () => {
    await signInWith(['View Patient Flags'], bpgOn);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [{ ...withBpg[0], adherence: null }],
      isLoading: false,
      error: undefined,
    });

    render(<Registry />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    const row = within(screen.getByRole('row', { name: /Patient 1\b/ })).getAllByRole('cell');
    expect(row[headers.indexOf('Adherence')]).toHaveTextContent(/^$/);
  });

  it('shows each patient’s BPG status and adherence once turned on', async () => {
    await signInWith(['View Patient Flags'], bpgOn);

    render(<Registry />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    const row = within(screen.getByRole('row', { name: /Patient 2\b/ })).getAllByRole('cell');
    expect(row[headers.indexOf('BPG status')]).toHaveTextContent('Not covered');
    expect(row[headers.indexOf('Adherence')]).toHaveTextContent('51%');
  });

  it('narrows the rows by BPG status', async () => {
    await signInWith(['View Patient Flags'], bpgOn);

    render(<Registry />);

    await userEvent.selectOptions(screen.getByLabelText('BPG status'), 'Due soon');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => within(r).queryByText('Due soon'))).toBe(true);
  });
});
