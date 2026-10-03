import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';
import { columnHeaders } from '../column-headers.test-helper';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

// The report's statuses, with the days until the next dose it gives beside them.
const statuses = [
  { bpg_status: 'Covered', days_until_due: 19 },
  { bpg_status: 'Not covered', days_until_due: -18 },
  { bpg_status: 'Deadline approaching', days_until_due: 5 },
  { bpg_status: 'No prescription', days_until_due: null },
  { bpg_status: null, days_until_due: 61 },
];

const withBpg = registryRows.map((row, i) => ({ ...row, ...statuses[i % statuses.length], adherence: 50 + i }));

function bpgCell(name: string) {
  const headers = columnHeaders();
  return within(screen.getByRole('row', { name: new RegExp(`${name}\\b`) })).getAllByRole('cell')[
    headers.indexOf('BPG status')
  ];
}

const bpgOn = { registry: { report: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890', showBpgColumns: true } };

describe('Registry BPG status and adherence', () => {
  beforeEach(() => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?status=');
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: withBpg,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it('leaves the columns and the filter out while the setting is off', async () => {
    await signInWith(['View Patient Flags']);

    render(<Registry />);

    const headers = columnHeaders();
    expect(headers).not.toContain('BPG status');
    expect(headers).not.toContain('Adherence');
    expect(screen.queryByLabelText('BPG status')).not.toBeInTheDocument();
  });

  it('ignores a BPG status in the URL while the setting is off', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?bpg=Covered');
    await signInWith(['View Patient Flags']);

    render(<Registry />);

    expect(screen.getByText(/of 30 items/)).toBeInTheDocument();
  });

  it('leaves the adherence empty for a patient who has none', async () => {
    await signInWith(['View Patient Flags'], bpgOn);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [{ ...withBpg[0], adherence: null }],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<Registry />);

    const headers = columnHeaders();
    const row = within(screen.getByRole('row', { name: /Patient 1\b/ })).getAllByRole('cell');
    expect(row[headers.indexOf('Adherence')]).toHaveTextContent(/^$/);
  });

  it('shows each patient’s adherence once turned on', async () => {
    await signInWith(['View Patient Flags'], bpgOn);

    render(<Registry />);

    const headers = columnHeaders();
    const row = within(screen.getByRole('row', { name: /Patient 2\b/ })).getAllByRole('cell');
    expect(within(row[headers.indexOf('Adherence')]).getByRole('img', { name: 'Adherence 51%' })).toHaveTextContent(
      '51%',
    );
  });

  it.each([
    ['Patient 1', 'Covered', 'cds--tag--green'],
    ['Patient 2', 'Not covered', 'cds--tag--red'],
    ['Patient 3', 'Due in 5 days', 'cds--tag--blue'],
    ['Patient 4', 'No prescription', 'cds--tag--warm-gray'],
  ])('shows %s’s BPG status as a %s tag', async (name, text, colour) => {
    await signInWith(['View Patient Flags'], bpgOn);

    render(<Registry />);

    const tag = within(bpgCell(name)).getByTestId('bpg-status');
    expect(tag).toHaveTextContent(new RegExp(`^${text}$`));
    expect(tag).toHaveClass(colour);
  });

  it('shows no BPG status tag for a patient the report gives none', async () => {
    await signInWith(['View Patient Flags'], bpgOn);

    render(<Registry />);

    expect(bpgCell('Patient 5')).toBeEmptyDOMElement();
  });

  it.each([
    [1, 'Due in 1 day'],
    [0, 'Due today'],
    [null, 'Due within 7 days'],
  ])('words a dose due in %s days as %s', async (days, text) => {
    await signInWith(['View Patient Flags'], bpgOn);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [{ ...withBpg[2], days_until_due: days }],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<Registry />);

    expect(within(bpgCell('Patient 3')).getByTestId('bpg-status')).toHaveTextContent(new RegExp(`^${text}$`));
  });

  it('offers the four statuses as the tags word them, whichever the rows have', async () => {
    await signInWith(['View Patient Flags'], bpgOn);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [withBpg[0]],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<Registry />);

    const options = within(screen.getByLabelText('BPG status')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'All',
      'Covered',
      'Due within 7 days',
      'Not covered',
      'No prescription',
    ]);
  });

  it.each([
    ['Covered', 'Covered'],
    ['Due within 7 days', 'Due in 5 days'],
    ['Not covered', 'Not covered'],
    ['No prescription', 'No prescription'],
  ])('narrows the rows to %s', async (option, tag) => {
    await signInWith(['View Patient Flags'], bpgOn);

    render(<Registry />);

    await userEvent.selectOptions(screen.getByLabelText('BPG status'), option);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => within(r).getByTestId('bpg-status').textContent === tag)).toBe(true);
  });
});
