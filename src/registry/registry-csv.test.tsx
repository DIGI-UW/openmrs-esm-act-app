import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

async function downloadedCsv() {
  const createObjectURL = vi.fn((blob: Blob) => 'blob:registry');
  window.URL.createObjectURL = createObjectURL as never;
  window.URL.revokeObjectURL = vi.fn();
  await userEvent.click(screen.getByRole('button', { name: /download csv/i }));
  return (createObjectURL.mock.calls[0][0] as Blob).text();
}

describe('Registry CSV download', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry');
    await signInWith(['View Patient Flags']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: registryRows,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it('downloads the filtered rows, from every page, with the visible columns as shown', async () => {
    render(<Registry />);
    await userEvent.selectOptions(screen.getByLabelText('Category at diagnosis'), 'RHD A');

    const lines = (await downloadedCsv()).trim().split('\r\n');

    expect(lines[0]).toBe('Name,ACT ID,Age,Sex,Diagnosis category,Prophylaxis regimen,Next consultation,Flags');
    expect(lines).toHaveLength(1 + 10);
    expect(lines[1]).toBe('Patient 1,rhd00001,10,F,RHD A,Q28 day BPG,15-Oct-2026,');
  });

  it('includes rows past the first page', async () => {
    render(<Registry />);

    const lines = (await downloadedCsv()).trim().split('\r\n');

    expect(lines).toHaveLength(1 + 30);
  });

  it("writes each patient's flags as the table shows them", async () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [{ ...registryRows[0], rhd_flags: 'RHD INR target missing|RHD prophylaxis overdue' }],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<Registry />);

    const lines = (await downloadedCsv()).trim().split('\r\n');

    expect(lines[1].endsWith(',RHD INR target missing; RHD prophylaxis overdue')).toBe(true);
  });

  it('quotes a value holding a comma or a quote', async () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [{ ...registryRows[0], full_name: 'Nambi, Esther "Essie"' }],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<Registry />);

    const lines = (await downloadedCsv()).trim().split('\r\n');

    expect(lines[1].startsWith('"Nambi, Esther ""Essie""",')).toBe(true);
  });

  it.each([
    ['=HYPERLINK("http://x")', `"'=HYPERLINK(""http://x"")"`],
    ['+256 700', "'+256 700"],
    ['-1', "'-1"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\t=1+1', "'\t=1+1"],
    ['\r=1+1', `"'\r=1+1"`],
  ])('writes %s as text, so a spreadsheet does not run it', async (name, cell) => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [{ ...registryRows[0], full_name: name }],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<Registry />);

    const lines = (await downloadedCsv()).trim().split('\r\n');

    expect(lines[1].startsWith(`${cell},`)).toBe(true);
  });
});
