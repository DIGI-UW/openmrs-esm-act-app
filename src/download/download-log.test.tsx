import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import DownloadLog from './download-log.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const entries = [
  {
    date: '2026-10-20T09:15:00.000+0000',
    user: { uuid: 'global', username: 'globaladmin' },
    form: { uuid: 'echo', name: 'RHD Echocardiogram' },
    detail: {
      fields: ['Date of Echocardiogram', 'Mitral valve: Regurgitation'],
      withheld: ['Home Address'],
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      rows: 34,
      identifiers: false,
      researchOnly: true,
    },
  },
  {
    date: '2026-10-20T09:00:00.000+0000',
    user: { uuid: 'nurse', username: 'nakato' },
    form: null,
    detail: {
      fields: ['Date of BPG'],
      withheld: [],
      startDate: null,
      endDate: null,
      rows: 3,
      identifiers: true,
      researchOnly: false,
    },
  },
];

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DownloadLog />
    </SWRConfig>,
  );
}

describe('DownloadLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists each download with who made it, the form's fields, its dates, its rows and whether it had identifiers", async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: entries } } as never);

    renderPage();

    await screen.findByText('globaladmin');
    const rows = screen.getAllByRole('row');
    expect(mockOpenmrsFetch).toHaveBeenCalledWith('/ws/rest/v1/actcore/download');
    const research = within(rows[1]);
    expect(research.getByText('globaladmin')).toBeInTheDocument();
    expect(research.getByText('RHD Echocardiogram')).toBeInTheDocument();
    expect(research.getByText('Date of Echocardiogram, Mitral valve: Regurgitation')).toBeInTheDocument();
    expect(research.getByText('2026-01-01 to 2026-06-30')).toBeInTheDocument();
    expect(research.getByText('34')).toBeInTheDocument();
    expect(research.getByText('Research participants, without identifiers')).toBeInTheDocument();
    const identified = within(rows[2]);
    expect(identified.getByText('All dates')).toBeInTheDocument();
    expect(identified.getByText('With identifiers')).toBeInTheDocument();
  });

  it('says so when there is no download yet', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } } as never);

    renderPage();

    expect(await screen.findByText('There are no downloads to display')).toBeInTheDocument();
  });

  it('shows why the downloads could not be loaded', async () => {
    mockOpenmrsFetch.mockRejectedValue(new Error('Privilege required: View Read Audit Logs'));

    renderPage();

    expect(await screen.findByText('Could not load the downloads')).toBeInTheDocument();
    expect(screen.getByText('Privilege required: View Read Audit Logs')).toBeInTheDocument();
  });
});
