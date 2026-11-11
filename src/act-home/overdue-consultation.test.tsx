import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate } from '@openmrs/esm-framework';
import { atSessionLocation, homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import OverdueConsultation from './overdue-consultation.component';
import { laidOut } from '../table-filters/laid-out.test-helper';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
vi.mock('./overdue-consultation.scss', () => ({
  default: { description: 'description', tableContainer: 'tableContainer', days: 'days', oneLine: 'oneLine' },
}));

const daysAgo = (days: number) => dayjs().subtract(days, 'day').format('YYYY-MM-DD');

const row = (i: number, nextConsultation: string | null) => ({
  patient_uuid: `patient-${i}`,
  full_name: `Patient ${i}`,
  rhd_id: `rhd0000${i}`,
  enrollment_status: 'Active',
  deceased: false,
  last_consultation_date: daysAgo(200),
  next_consultation_date: nextConsultation,
});

function registry(rows: Array<Record<string, unknown>>, value = {}) {
  vi.mocked(useReportDataset).mockReturnValue({
    columns: [],
    rows,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
    ...value,
  });
}

describe('Overdue for consultation', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([homePrivilege, 'App: act.registry']);
  });

  it('lists the patients whose review date has passed, longest overdue first, with how many', () => {
    registry([row(1, daysAgo(8)), row(2, daysAgo(108)), row(3, daysAgo(0)), row(4, null), row(5, daysAgo(-5))]);

    render(<OverdueConsultation />);

    expect(screen.getByText('2 patients')).toBeInTheDocument();
    expect(screen.getByText('Cardiology review date has passed')).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      'Patient 2rhd00002',
      'Patient 1rhd00001',
    ]);
    expect(within(rows[0]).getByText('108 days')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: 'Patient 2' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-2/chart',
    );
  });

  it("lists only the patients of the session's cardiac clinic", async () => {
    registry([
      { ...row(1, daysAgo(8)), cardiac_clinic: 'Gulu RRH' },
      { ...row(2, daysAgo(30)), cardiac_clinic: 'Lira RRH' },
    ]);
    atSessionLocation('Gulu RRH', ['RHD District']);

    render(<OverdueConsultation />);

    expect(await screen.findByText(/^1 patients?$/)).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Patient 1rhd00001']);
  });

  it('leaves out a completed enrolment and a patient who has died', () => {
    registry([
      row(1, daysAgo(8)),
      { ...row(2, daysAgo(30)), enrollment_status: 'Completed' },
      { ...row(3, daysAgo(40)), deceased: true },
    ]);

    render(<OverdueConsultation />);

    expect(screen.getByText(/^1 patients?$/)).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Patient 1rhd00001']);
  });

  it('shows them a page at a time, so a long list does not push the rest of ACT home down', async () => {
    registry(Array.from({ length: 12 }, (_, i) => row(i + 1, daysAgo(100 - i))));

    render(<OverdueConsultation />);

    const names = () =>
      within(screen.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((r) => within(r).getAllByRole('cell')[0].textContent);
    expect(screen.getByText('12 patients')).toBeInTheDocument();
    expect(names()).toHaveLength(10);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(names()).toEqual(['Patient 11rhd000011', 'Patient 12rhd000012']);
  });

  it("opens a patient's chart", async () => {
    registry([row(1, daysAgo(8))]);

    render(<OverdueConsultation />);
    await userEvent.click(screen.getByRole('button', { name: 'Open chart' }));

    expect(vi.mocked(navigate)).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/patient-1/chart' });
  });

  it('fits half the page: Open chart is a small ghost button, and a name and a header may wrap', () => {
    registry([row(1, daysAgo(8))]);

    render(<OverdueConsultation />);

    expect(screen.getByRole('button', { name: 'Open chart' })).toHaveClass('cds--btn--ghost', 'cds--btn--sm');
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells.map((cell) => cell.classList.contains('oneLine'))).toEqual([false, true, true, true, true]);
    const sheet = readFileSync(resolve(process.cwd(), 'src/act-home/overdue-consultation.scss'), 'utf8');
    expect(sheet).toMatch(/\.oneLine\s*\{[^}]*white-space: nowrap;/);
    expect(sheet.match(/white-space: nowrap;/g)).toHaveLength(1);
  });

  it('shows a shadow at the edge it is cut at, when the card is too narrow for the table', () => {
    registry([row(1, daysAgo(8))]);

    render(<OverdueConsultation />);
    // eslint-disable-next-line testing-library/no-node-access
    const scroller = screen.getByRole('table').parentElement;
    laidOut(scroller, { scrollWidth: 506, clientWidth: 434 });
    fireEvent.scroll(scroller);

    expect(scroller).toHaveClass('cds--data-table-content');
    expect(screen.getByTestId('scroll-edges')).toHaveAttribute('data-more-end');
  });

  it('says so when nobody is overdue', () => {
    registry([row(1, daysAgo(-3))]);

    render(<OverdueConsultation />);

    expect(screen.getByTestId('table-empty-state')).toHaveTextContent('No patient is overdue for consultation');
  });

  it('says so when the registry cannot be loaded', () => {
    registry([], { error: new Error('down') });

    render(<OverdueConsultation />);

    expect(screen.getByText('Could not load the patients overdue for consultation')).toBeInTheDocument();
  });
});
