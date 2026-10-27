import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { downloadCsv } from './csv';
import { DownloadCsvButton } from './download-csv-button.component';

vi.mock('./csv', () => ({ downloadCsv: vi.fn() }));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('DownloadCsvButton', () => {
  beforeEach(async () => {
    await signInWith(['Task: act.lists.export']);
  });

  it("records the download in ACT Core's log, with the list, columns, row count, identifiers and filters, before making the file", async () => {
    const order: Array<string> = [];
    mockOpenmrsFetch.mockImplementation((async () => {
      order.push('record');
      return { data: {} };
    }) as never);
    vi.mocked(downloadCsv).mockImplementation(() => {
      order.push('file');
    });
    render(
      <DownloadCsvButton
        name="registry"
        list="registry"
        identifiers
        filters={{ status: 'Active' }}
        headers={['Name', 'ACT ID']}
        rows={() => [
          ['Grace Akello', 'rhd00001'],
          ['Samuel Okello', 'rhd00002'],
        ]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(downloadCsv).toHaveBeenCalled());
    expect(mockOpenmrsFetch).toHaveBeenCalledWith('/ws/rest/v1/actcore/download/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        list: 'registry',
        columns: ['Name', 'ACT ID'],
        rows: 2,
        identifiers: true,
        filters: { status: 'Active' },
      },
    });
    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^registry-\d{4}-\d{2}-\d{2}\.csv$/),
      ['Name', 'ACT ID'],
      [
        ['Grace Akello', 'rhd00001'],
        ['Samuel Okello', 'rhd00002'],
      ],
    );
    expect(order).toEqual(['record', 'file']);
  });

  it('makes no file when the download cannot be recorded, and says so', async () => {
    mockOpenmrsFetch.mockRejectedValue(
      Object.assign(new Error('403'), {
        responseBody: { error: { message: 'Privilege required: Task: act.downloadData' } },
      }),
    );
    render(
      <DownloadCsvButton name="registry" list="registry" identifiers headers={['Name']} rows={() => [['Grace']]} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Could not record the download, so no file was made',
        subtitle: 'Privilege required: Task: act.downloadData',
      }),
    );
    expect(downloadCsv).not.toHaveBeenCalled();
  });

  it('waits for rows that are fetched, as the Logs tabs fetch every page', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as never);
    render(
      <DownloadCsvButton
        name="logs-activity"
        list="logs:activity"
        identifiers
        headers={['Time']}
        rows={() => Promise.resolve([['Today, 10:52']])}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(downloadCsv).toHaveBeenCalledWith(expect.any(String), ['Time'], [['Today, 10:52']]));
  });

  it('shows nothing to a user who may not export lists', async () => {
    await signInWith(['App: act.registry']);
    render(<DownloadCsvButton name="registry" list="registry" identifiers headers={['Name']} rows={() => []} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
