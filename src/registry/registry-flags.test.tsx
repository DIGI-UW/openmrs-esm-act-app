import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate } from '@openmrs/esm-framework';
import { setLayout } from '../table-skeleton.test-helper';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';
import { columnHeaders } from '../column-headers.test-helper';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const withFlags = (flags: Array<string | null>) =>
  registryRows.map((row, i) => ({ ...row, rhd_flags: flags[i] ?? null }));

const flaggedRows = withFlags(['RHD INR target missing|RHD prophylaxis overdue', 'RHD prophylaxis overdue', null]);

const columnRows = withFlags([
  'RHD INR target missing|RHD prophylaxis overdue',
  'RHD prophylaxis overdue',
  null,
  'RHD INR target missing',
  'RHD INR target missing|RHD perfusion issues not recorded|RHD site infection not recorded',
  'RHD 30-day follow-up due|RHD INR target missing|RHD lost to follow-up|RHD prophylaxis overdue',
  'RHD lost to follow-up|RHD prophylaxis overdue',
  'RHD 30-day follow-up due|RHD INR target missing',
  'RHD 30-day follow-up due|RHD prophylaxis overdue',
]);

function flagsOf(name: string) {
  return within(screen.getByRole('row', { name: new RegExp(`${name}\\b`) }))
    .queryAllByTestId('registry-flag')
    .map((tag) => [tag.textContent, tag.getAttribute('data-priority'), tag.className.includes('cds--tag--red')]);
}

// A Toggletip puts a tooltip's text one element inside the box it floats in, which has no role.
// eslint-disable-next-line testing-library/no-node-access
const floatingBoxOf = (text: string) => screen.getByText(text).closest('.cds--popover-content');

describe('Registry flags column', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    // An explicit All, so every row shows, rather than the opening defaults.
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?status=');
    await signInWith(['View Patient Flags']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: columnRows,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it("shows a patient's one RHD flag as its tag, a risk flag red and a missing data flag orange", () => {
    render(<Registry />);

    expect(columnHeaders()).toContain('Flags');
    expect(flagsOf('Patient 2')).toEqual([['RHD prophylaxis overdue', 'risk', true]]);
    expect(flagsOf('Patient 4')).toEqual([['RHD INR target missing', 'dataQuality', false]]);
    expect(flagsOf('Patient 3')).toEqual([]);
  });

  it('shows several flags as one "N flags" tag, red when any is a risk flag, otherwise orange', () => {
    render(<Registry />);

    expect(flagsOf('Patient 1')).toEqual([['2 flags', 'risk', true]]);
    expect(flagsOf('Patient 5')).toEqual([['3 flags', 'dataQuality', false]]);
  });

  const patient1Flags = 'RHD INR target missing, RHD prophylaxis overdue';
  const flagsTag = () =>
    within(screen.getByRole('row', { name: /Patient 1\b/ })).getByRole('button', { name: '2 flags' });

  it('on a desktop, shows the flags behind "N flags" in a tooltip on hover, without opening the chart', async () => {
    setLayout('small-desktop');
    render(<Registry />);

    expect(flagsTag()).toHaveAccessibleDescription(patient1Flags);
    expect(flagsTag()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.hover(flagsTag());

    expect(flagsTag()).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByText(patient1Flags));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('on a tablet, opens the flags behind "N flags" on a tap, which its trailing mouseleave does not close, without opening the chart', async () => {
    setLayout('tablet');
    render(<Registry />);

    expect(flagsTag()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(flagsTag());
    fireEvent.mouseLeave(flagsTag());

    expect(flagsTag()).toHaveAttribute('aria-expanded', 'true');
    expect(flagsTag()).toHaveAccessibleDescription(patient1Flags);
    await userEvent.click(screen.getByText(patient1Flags));
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    { layout: 'small-desktop' as const, open: (tag: HTMLElement) => userEvent.hover(tag) },
    { layout: 'tablet' as const, open: (tag: HTMLElement) => userEvent.click(tag) },
  ])(
    'on $layout, floats an "N flags" tooltip over the page when there are no more rows below it than it has flags',
    async ({ layout, open }) => {
      setLayout(layout);
      render(<Registry />);
      const tagOf = (name: RegExp, count: number) =>
        within(screen.getByRole('row', { name })).getByRole('button', { name: `${count} flags` });

      // On the page of ten: Patient 8 has 2 flags and 2 rows below; Patient 6, 4 flags and 4 below.
      await open(tagOf(/Patient 8\b/, 2));
      expect(floatingBoxOf('RHD 30-day follow-up due, RHD INR target missing')).toHaveStyle({ position: 'fixed' });
      await open(tagOf(/Patient 6\b/, 4));
      expect(
        floatingBoxOf(
          'RHD 30-day follow-up due, RHD INR target missing, RHD lost to follow-up, RHD prophylaxis overdue',
        ),
      ).toHaveStyle({ position: 'fixed' });
      // Patient 7 has 2 flags and 3 rows below: room enough, so it stays in place.
      await open(tagOf(/Patient 7\b/, 2));
      expect(floatingBoxOf('RHD lost to follow-up, RHD prophylaxis overdue')).not.toHaveStyle({ position: 'fixed' });
    },
  );

  it('renders the "N flags" tag as a span, as the content of its tooltip button must be', () => {
    render(<Registry />);

    expect(within(screen.getByRole('row', { name: /Patient 1\b/ })).getByTestId('registry-flag').tagName).toBe('SPAN');
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

    expect(flagsOf('Patient 1')).toEqual([['2 flags', 'risk', true]]);
    expect(flagsOf('Patient 4')).toEqual([['RHD INR target missing', 'risk', true]]);
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
      .map((row) => within(row).getByRole('link').textContent);

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

  it('opens narrowed to the flag in the URL, as an ACT home worklist tile links to it', () => {
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
