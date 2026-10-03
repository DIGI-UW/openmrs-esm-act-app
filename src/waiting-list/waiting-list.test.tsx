import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
import { layouts, setLayout, tableSkeleton } from '../table-skeleton.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { waitingListRows } from './waiting-list.fixture';
import WaitingList from './waiting-list.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
const mockUseReportDataset = vi.mocked(useReportDataset);

function dataset(value: Partial<ReturnType<typeof useReportDataset>>) {
  mockUseReportDataset.mockReturnValue({
    columns: [],
    rows: [],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
    ...value,
  });
}

describe('Procedural waiting list', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-waiting-list');
    await signInWith(['View Patient Flags']);
  });

  it("lists each open recommendation with its patient's ACT ID, sex, age, type, procedure, urgency, district, contraindications and repair suitability", () => {
    dataset({ rows: waitingListRows });

    render(<WaitingList />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers.slice(0, 7)).toEqual(['ACT ID', 'Sex', 'Age', 'Date of birth', 'Type', 'Procedure', 'Urgency']);
    expect(headers).toEqual(expect.arrayContaining(['District', 'Contraindications', 'Suitable for repair']));
    const cells = (id: string) =>
      Object.fromEntries(
        within(screen.getByRole('row', { name: new RegExp(`${id}\\b`) }))
          .getAllByRole('cell')
          .map((cell, i) => [headers[i], cell.textContent]),
      );
    expect(cells('rhd00001')).toMatchObject({
      'ACT ID': 'rhd00001',
      Sex: 'F',
      Age: '10',
      'Date of birth': '15-Mar-2016',
      Type: 'Catheterization',
      Procedure: 'Mitral balloon valvuloplasty',
      Urgency: '3: Elective (180 days)',
      District: 'KITGUM',
      Contraindications: 'Yes',
      'Suitable for repair': 'No',
    });
  });

  it('evaluates the configured report', () => {
    dataset({ rows: waitingListRows });

    render(<WaitingList />);

    expect(mockUseReportDataset).toHaveBeenLastCalledWith('5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10');
  });

  it('shows the recommendations a page at a time', async () => {
    dataset({ rows: waitingListRows });

    render(<WaitingList />);

    expect(screen.getAllByRole('row')).toHaveLength(1 + 10);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText(/11–20 of 30 items/)).toBeInTheDocument();
  });

  it('says so when no recommendation is open', () => {
    dataset({ rows: [] });

    render(<WaitingList />);

    expect(screen.getByTestId('table-empty-state')).toHaveTextContent(
      'There are no procedural recommendations to display',
    );
  });

  it('says so when the report cannot be loaded', () => {
    dataset({ error: new Error('Server responded with 404') });

    render(<WaitingList />);

    expect(screen.getByText('Could not load the procedural waiting list')).toBeInTheDocument();
  });

  it.each(layouts)(
    'loads as a table skeleton of a page of rows, sized as its table on $layout',
    ({ layout, compact, size }) => {
      setLayout(layout);
      dataset({ isLoading: true });
      const { rerender } = render(<WaitingList />);

      const { skeleton, rows, columns } = tableSkeleton();
      expect({ rows, columns }).toEqual({ rows: 10, columns: 12 });
      expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
      dataset({ rows: waitingListRows });
      rerender(<WaitingList />);
      expect(screen.getByRole('table')).toHaveClass(`cds--data-table--${size}`);
    },
  );

  it('tells a user without the waiting list privilege that they cannot see it', async () => {
    await signInWith(['Get Patients'], {
      screenPrivileges: {
        home: 'x',
        registry: 'x',
        worklists: 'x',
        waitingList: 'App: act.waitinglist',
        screenPositive: 'x',
      },
    });
    dataset({ rows: waitingListRows });

    render(<WaitingList />);

    expect(screen.getByText('You do not have access to the procedural waiting list.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
