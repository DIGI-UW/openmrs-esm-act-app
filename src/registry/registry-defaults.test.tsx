import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const registryUrl = '/openmrs/spa/home/act-registry';

async function atLocation(display: string | null, tags: Array<string> = []) {
  await signInWith(['App: act.registry']);
  const session = vi.mocked(useSession).getMockImplementation()?.() ?? vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    sessionLocation: display ? { uuid: 'session-location', display } : undefined,
  } as never);
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { tags: tags.map((tag) => ({ display: tag })) } } as never);
}

function renderRegistry() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Registry />
    </SWRConfig>,
  );
}

const matching = () => Number(screen.getByText(/of \d+ items/).textContent.match(/of (\d+) items/)[1]);

describe('Registry defaults', () => {
  beforeEach(() => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', registryUrl);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: registryRows,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it("opens on the active patients of the session's cardiac clinic", async () => {
    await atLocation('Gulu RRH', ['Login Location', 'RHD District']);

    renderRegistry();

    await waitFor(() => expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('Gulu RRH'));
    expect(screen.getByLabelText('Status')).toHaveValue('Active');
    // The fixture's 15 Gulu RRH patients include Patient 4, its one Completed enrolment.
    expect(matching()).toBe(14);
    expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toContain('/location/session-location');
  });

  it('opens on active patients at every clinic when the session location is not a cardiac clinic', async () => {
    await atLocation('Acimi HCIII', ['Login Location', 'RHD Community']);

    renderRegistry();

    await waitFor(() => expect(screen.getByLabelText('Status')).toHaveValue('Active'));
    expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('');
    expect(matching()).toBe(29);
  });

  it('lets a filter in the URL win over the defaults', async () => {
    window.history.replaceState(null, '', `${registryUrl}?status=Completed`);
    await atLocation('Gulu RRH', ['RHD District']);

    renderRegistry();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByLabelText('Status')).toHaveValue('Completed');
    expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('');
    expect(matching()).toBe(1);
  });

  it('keeps All once chosen, through a reload of the URL it writes', async () => {
    await atLocation('Gulu RRH', ['RHD District']);
    const { unmount } = renderRegistry();
    await waitFor(() => expect(screen.getByLabelText('Status')).toHaveValue('Active'));

    await userEvent.selectOptions(screen.getByLabelText('Status'), '');
    await userEvent.selectOptions(screen.getByLabelText('Cardiac clinic'), '');
    await waitFor(() => expect(window.location.search).toBe('?status=&cardiac='));
    unmount();
    renderRegistry();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByLabelText('Status')).toHaveValue('');
    expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('');
    expect(matching()).toBe(30);
  });

  it('does not write the URL before the defaults are known', async () => {
    await atLocation('Gulu RRH', ['RHD District']);
    let answer: (value: unknown) => void;
    vi.mocked(openmrsFetch).mockReturnValue(new Promise((resolve) => (answer = resolve)) as never);

    renderRegistry();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(window.location.search).toBe('');

    await act(async () => answer({ data: { tags: [{ display: 'RHD District' }] } }));
    await waitFor(() => expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('Gulu RRH'));
  });

  it('opens on the defaults again when the Registry link resets the URL', async () => {
    await atLocation('Gulu RRH', ['RHD District']);
    window.history.replaceState(null, '', `${registryUrl}?category=RHD+B`);
    renderRegistry();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByLabelText('Status')).toHaveValue('');

    act(() => {
      window.history.replaceState(null, '', registryUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('Gulu RRH'));
    expect(screen.getByLabelText('Status')).toHaveValue('Active');
    expect(screen.getByLabelText('Category at diagnosis')).toHaveValue('');
  });

  it('keeps a bookmarked All while the session location is still being looked up', async () => {
    window.history.replaceState(null, '', `${registryUrl}?status=&cardiac=`);
    await atLocation('Gulu RRH', ['RHD District']);
    let answer: (value: unknown) => void;
    vi.mocked(openmrsFetch).mockReturnValue(new Promise((resolve) => (answer = resolve)) as never);

    renderRegistry();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(window.location.search).toBe('?status=&cardiac=');

    await act(async () => answer({ data: { tags: [{ display: 'RHD District' }] } }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(window.location.search).toBe('?status=&cardiac=');
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('shows its skeleton, not every patient, while the opening defaults are worked out', async () => {
    await atLocation('Gulu RRH', ['RHD District']);
    vi.mocked(openmrsFetch).mockReturnValue(new Promise(() => {}) as never);

    renderRegistry();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('opens on the defaults when the session location is already known, as on a return to the registry', async () => {
    await atLocation('Gulu RRH', ['RHD District']);
    const cache = new Map();
    const registry = () => (
      <SWRConfig value={{ provider: () => cache }}>
        <Registry />
      </SWRConfig>
    );
    const view = render(registry());
    await waitFor(() => expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('Gulu RRH'));
    view.unmount();
    window.history.replaceState(null, '', registryUrl);

    render(registry());

    expect(screen.getByLabelText('Status')).toHaveValue('Active');
    expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('Gulu RRH');
  });
});
