import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const flaggedRows = registryRows.map((row, i) => ({
  ...row,
  rhd_flags: ['RHD INR target missing|RHD prophylaxis overdue', 'RHD prophylaxis overdue', null][i] ?? null,
}));

function flagsOf(name: string) {
  return within(screen.getByRole('row', { name: new RegExp(`${name}\\b`) }))
    .queryAllByTestId('registry-flag')
    .map((tag) => [tag.textContent, tag.getAttribute('data-priority'), tag.className.includes('cds--tag--red')]);
}

describe('Registry flags column', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry');
    await signInWith(['View Patient Flags']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: flaggedRows,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it("shows each patient's RHD flags from the report, risk flags red and missing data flags orange", () => {
    render(<Registry />);

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toContain('Flags');
    expect(flagsOf('Patient 1')).toEqual([
      ['RHD INR target missing', 'dataQuality', false],
      ['RHD prophylaxis overdue', 'risk', true],
    ]);
    expect(flagsOf('Patient 2')).toEqual([['RHD prophylaxis overdue', 'risk', true]]);
    expect(flagsOf('Patient 3')).toEqual([]);
  });

  it.each([
    ['names', { namePrefix: 'RHD ', names: ['RHD prophylaxis overdue'] }],
    ['namePrefix', { namePrefix: 'RHD prophylaxis', names: [] }],
  ])('shows only the flags the configuration selects by %s', async (_, selection) => {
    await signInWith(['View Patient Flags'], {
      flagLists: { riskFlags: ['RHD prophylaxis overdue'], ...selection },
    });

    render(<Registry />);

    expect(flagsOf('Patient 1')).toEqual([['RHD prophylaxis overdue', 'risk', true]]);
  });

  it('takes the risk flags from the configuration', async () => {
    await signInWith(['View Patient Flags'], {
      flagLists: { namePrefix: 'RHD ', names: [], riskFlags: ['RHD INR target missing'] },
    });

    render(<Registry />);

    expect(flagsOf('Patient 1')).toEqual([
      ['RHD INR target missing', 'risk', true],
      ['RHD prophylaxis overdue', 'dataQuality', false],
    ]);
  });
});

describe('Registry flag filter', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['View Patient Flags']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: flaggedRows,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  const shownNames = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);

  it('offers the flags the patients carry and narrows the rows to one', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry');
    render(<Registry />);

    expect(
      within(screen.getByLabelText('RHD flag'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All', 'RHD INR target missing', 'RHD prophylaxis overdue']);
    await userEvent.selectOptions(screen.getByLabelText('RHD flag'), 'RHD INR target missing');

    expect(shownNames()).toEqual(['Patient 1']);
  });

  it("opens narrowed to the flag in the URL, as an ACT home worklist tile links to it", () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?flag=RHD+prophylaxis+overdue');
    render(<Registry />);

    expect(screen.getByLabelText('RHD flag')).toHaveValue('RHD prophylaxis overdue');
    expect(shownNames()).toEqual(['Patient 1', 'Patient 2']);
  });

  it('offers only the flags the configuration selects', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry');
    await signInWith(['View Patient Flags'], {
      flagLists: { riskFlags: ['RHD prophylaxis overdue'], namePrefix: 'RHD ', names: ['RHD prophylaxis overdue'] },
    });
    render(<Registry />);

    expect(
      within(screen.getByLabelText('RHD flag'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All', 'RHD prophylaxis overdue']);
  });
});
