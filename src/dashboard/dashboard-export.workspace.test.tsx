import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ExportChoice, setExportSummary } from './dashboard-export';
import DashboardExportWorkspace from './dashboard-export.workspace';

const run = vi.fn(async (_choice: ExportChoice, close: () => void) => close());
const closeWorkspace = vi.fn();

function renderWorkspace(showScreening = true) {
  return render(
    <DashboardExportWorkspace
      workspaceProps={{ summary: 'Gulu RRH · figures as of 28-Oct-2026', showScreening, run }}
      windowProps={null}
      groupProps={null}
      launchChildWorkspace={vi.fn()}
      closeWorkspace={closeWorkspace}
      workspaceName="act-dashboard-export-workspace"
      windowName="act-dashboard-export"
      isRootWorkspace
      showActionMenu={false}
    />,
  );
}

describe('Dashboard export workspace', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says what the Dashboard counts now, not only what it counted when the workspace opened', () => {
    renderWorkspace();

    act(() => setExportSummary('Lira RRH · figures as of 28-Oct-2026'));
    expect(screen.getByText('Lira RRH · figures as of 28-Oct-2026')).toBeInTheDocument();
    act(() => setExportSummary(''));
  });

  it('says what the Dashboard counts, and exports every section as a PDF unless told otherwise', async () => {
    renderWorkspace();

    expect(screen.getByText('Gulu RRH · figures as of 28-Oct-2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Export PDF of 10 sections' }));

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'pdf',
        orientation: 'portrait',
        sections: expect.arrayContaining(['runCharts']),
      }),
      expect.any(Function),
    );
    expect(closeWorkspace).toHaveBeenCalled();
  });

  it('asks for the sections ticked, in page order, in the format and orientation chosen', async () => {
    renderWorkspace();

    await userEvent.click(screen.getByRole('button', { name: 'None' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Procedural waitlist' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Key figures' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Orientation' }), 'landscape');
    await userEvent.click(screen.getByRole('button', { name: 'Export PDF of 2 sections' }));

    expect(run.mock.lastCall[0]).toEqual({
      format: 'pdf',
      sections: ['keyFigures', 'waitlist'],
      orientation: 'landscape',
    });
  });

  it('offers no run charts for the counts CSV, as they have no counts', async () => {
    renderWorkspace();

    await userEvent.click(screen.getByRole('radio', { name: /^Counts \(CSV\)/ }));

    expect(screen.getByRole('checkbox', { name: 'Run charts' })).toBeDisabled();
    expect(screen.queryByRole('combobox', { name: 'Orientation' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV of 9 sections' }));
    expect(run.mock.lastCall[0].sections).not.toContain('runCharts');
  });

  it('offers no screening sections at a site without a screening programme', () => {
    renderWorkspace(false);

    expect(screen.queryByRole('checkbox', { name: 'RHD screening' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF of 7 sections' })).toBeEnabled();
  });

  it('exports nothing when no section is ticked', async () => {
    renderWorkspace();

    await userEvent.click(screen.getByRole('button', { name: 'None' }));

    expect(screen.getByRole('button', { name: 'Export PDF of 0 sections' })).toBeDisabled();
  });
});
