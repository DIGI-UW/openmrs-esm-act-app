import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

function shownNames() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('td').textContent);
}

/** How many rows the filters leave, over every page, as the pagination counts them. */
function matching() {
  return Number(screen.getByText(/of \d+ items/).textContent.match(/of (\d+) items/)[1]);
}

async function choose(label: string, option: string) {
  await userEvent.selectOptions(screen.getByLabelText(label), option);
}

describe('Registry filters', () => {
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

  it('narrows the rows by status', async () => {
    render(<Registry />);

    await choose('Status', 'Completed');

    expect(shownNames()).toEqual(['Patient 4']);
  });

  it('narrows the rows by cardiac clinic, offering the clinics the patients are assigned to', async () => {
    render(<Registry />);

    await screen.findByRole('option', { name: 'Lira RRH' });
    expect(screen.getAllByRole('option', { name: /RRH/ }).map((option) => option.textContent)).toEqual([
      'Gulu RRH',
      'Lira RRH',
    ]);
    await choose('Cardiac clinic', 'Gulu RRH');

    expect(matching()).toBe(15);
    expect(shownNames().every((name) => Number(name.split(' ')[1]) % 2 === 0)).toBe(true);
  });

  it('narrows the rows by primary care clinic', async () => {
    render(<Registry />);

    expect(
      within(screen.getByLabelText('Primary care clinic'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All', 'Anyeke HCIV']);
    await choose('Primary care clinic', 'Anyeke HCIV');

    expect(matching()).toBe(15);
  });

  it('narrows the rows by category at diagnosis', async () => {
    render(<Registry />);

    await choose('Category at diagnosis', 'RHD B');

    expect(shownNames()).toEqual([
      'Patient 2',
      'Patient 5',
      'Patient 8',
      'Patient 11',
      'Patient 14',
      'Patient 17',
      'Patient 20',
      'Patient 23',
      'Patient 26',
      'Patient 29',
    ]);
  });

  it("keeps offering every patient's values once a filter is set, so another can be picked", async () => {
    render(<Registry />);

    await choose('Category at diagnosis', 'RHD A');
    await choose('Status', 'Completed');

    const options = (label: string) =>
      within(screen.getByLabelText(label))
        .getAllByRole('option')
        .map((option) => option.textContent);
    expect(options('Category at diagnosis')).toEqual(['All', 'RHD A', 'RHD B', 'RHD C']);
    expect(options('Status')).toEqual(['All', 'Active', 'Completed']);
  });

  it('finds patients by name or ACT ID', async () => {
    render(<Registry />);

    await userEvent.type(screen.getByRole('searchbox'), 'rhd00012');
    expect(shownNames()).toEqual(['Patient 12']);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'patient 3');
    expect(shownNames()).toEqual(['Patient 3', 'Patient 30']);
  });

  it('goes back to the first page when a filter changes', async () => {
    render(<Registry />);

    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    await choose('Status', 'Active');

    expect(shownNames()[0]).toBe('Patient 1');
  });

  it('shows a filter value from the URL that no patient has, so it can be cleared', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?cardiac=Old+clinic');

    render(<Registry />);

    expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('Old clinic');
    expect(screen.getByText('No patients match these filters.')).toBeInTheDocument();
    await choose('Cardiac clinic', '');
    expect(matching()).toBe(30);
  });

  it('follows the URL when the Registry link resets it', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?category=RHD+B');
    render(<Registry />);
    expect(shownNames()).toHaveLength(10);

    act(() => {
      window.history.replaceState(null, '', '/openmrs/spa/home/act-registry');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByLabelText('Category at diagnosis')).toHaveValue('');
    expect(matching()).toBe(30);
  });

  it('starts again from the first page when the Registry link resets the filters', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?status=Active');
    render(<Registry />);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));

    act(() => {
      window.history.replaceState(null, '', '/openmrs/spa/home/act-registry');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(shownNames()[0]).toBe('Patient 1');
  });

  it('keeps the page when another app changes the URL but not the filters', async () => {
    render(<Registry />);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(shownNames()[0]).toBe('Patient 11');
  });

  it('writes the URL once typing has paused, not on every key', () => {
    vi.useFakeTimers();
    render(<Registry />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pat' } });
    act(() => vi.advanceTimersByTime(299));
    expect(window.location.search).toBe('');
    act(() => vi.advanceTimersByTime(1));
    vi.useRealTimers();

    expect(new URLSearchParams(window.location.search).get('q')).toBe('pat');
  });

  it('says so when no patient matches the filters', async () => {
    render(<Registry />);

    await userEvent.type(screen.getByRole('searchbox'), 'nobody');

    expect(screen.getByText('No patients match these filters.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/items per page/i)).not.toBeInTheDocument();
  });

  it('takes a filter set back to All out of the URL', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?category=RHD+B&status=Active');
    render(<Registry />);

    await choose('Category at diagnosis', '');

    await waitFor(() => expect(new URLSearchParams(window.location.search).has('category')).toBe(false));
    expect(new URLSearchParams(window.location.search).get('status')).toBe('Active');
  });

  it('keeps the filters in the URL and restores them from it', async () => {
    const { unmount } = render(<Registry />);
    await choose('Category at diagnosis', 'RHD C');
    await userEvent.type(screen.getByRole('searchbox'), 'patient 1');
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('q')).toBe('patient 1'));
    expect(new URLSearchParams(window.location.search).get('category')).toBe('RHD C');
    unmount();

    render(<Registry />);

    expect(screen.getByLabelText('Category at diagnosis')).toHaveValue('RHD C');
    expect(screen.getByRole('searchbox')).toHaveValue('patient 1');
    expect(shownNames()).toEqual(['Patient 12', 'Patient 15', 'Patient 18']);
  });
});
