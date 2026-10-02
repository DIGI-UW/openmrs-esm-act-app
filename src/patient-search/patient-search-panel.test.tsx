import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import {
  age,
  getDefaultsFromConfigSchema,
  navigate,
  openmrsFetch,
  useConfig,
  useDebounce,
  useSession,
} from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { PatientSearchPanel } from './patient-search-panel.component';

const actIdType = '240f85fa-46e1-540e-9234-2796c623f7ea';

function patient(uuid: string, name: string, actId: string, gender = 'F') {
  return {
    uuid,
    person: { display: name, gender, age: 15, birthdate: '2011-03-14T00:00:00.000+0000' },
    identifiers: [
      { identifier: 'NAT-1', identifierType: { uuid: 'national-id' } },
      { identifier: actId, identifierType: { uuid: actIdType } },
    ],
  };
}

const grace = patient('grace', 'Grace Achieng', 'rhd00008');
const esther = patient('esther', 'Esther Nambi', 'rhd00001');
const statusOf: Record<string, string> = { grace: 'overdue', esther: 'ok' };
let searchTotal: number | undefined;

let visited = 'esther';
const posted: Array<object> = [];

function serve() {
  vi.mocked(openmrsFetch).mockImplementation(((url: string, init?: { method?: string; body?: object }) => {
    if (init?.method === 'POST') {
      posted.push(init.body);
      return Promise.resolve({ data: {} });
    }
    if (url.includes('/user/')) {
      return Promise.resolve({ data: { userProperties: { defaultLocale: 'en', patientsVisited: visited } } });
    }
    if (url.includes('/actcore/prophylaxis')) {
      const uuid = new URL(url, 'http://x').searchParams.get('patient');
      return Promise.resolve({ data: { status: statusOf[uuid] ?? 'none' } });
    }
    const one = url.match(/\/patient\/([^?]+)\?/);
    if (one) {
      return Promise.resolve({ data: { grace, esther }[one[1]] });
    }
    const q = decodeURIComponent(new URL(url, 'http://x').searchParams.get('q') ?? '').toLowerCase();
    const found = [grace, esther].filter(
      (p) => p.person.display.toLowerCase().includes(q) || p.identifiers.some((i) => i.identifier === q),
    );
    return Promise.resolve({ data: { results: found, totalCount: searchTotal } });
  }) as never);
}

function renderPanel(props: Partial<React.ComponentProps<typeof PatientSearchPanel>> = {}) {
  const onClose = vi.fn();
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <PatientSearchPanel onClose={onClose} {...props} />
    </SWRConfig>,
  );
  return { onClose };
}

const search = () => screen.getByRole('searchbox', { name: 'Search for a patient by name or ACT ID' });

describe('PatientSearchPanel', () => {
  beforeEach(() => {
    visited = 'esther';
    searchTotal = undefined;
    posted.length = 0;
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    vi.mocked(useConfig<Config>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
    vi.mocked(useSession).mockReturnValue({ user: { uuid: 'clinician' } } as never);
    vi.mocked(useDebounce).mockImplementation((value) => value);
    vi.mocked(age).mockImplementation(() => '15 yrs');
    serve();
  });

  it('lists the recently viewed patients before a search', async () => {
    renderPanel();

    expect(screen.getByText('Recently viewed patients')).toBeInTheDocument();
    const row = await screen.findByRole('button', { name: /Esther Nambi/ });
    expect(row).toHaveTextContent('Female · 15 yrs · 14-Mar-2011 · ACT ID rhd00001');
    expect(await within(row).findByText('Up to date')).toBeInTheDocument();
  });

  it('finds a patient by name, with their ACT ID and prophylaxis status', async () => {
    renderPanel();

    await userEvent.type(search(), 'Grace');

    const row = await screen.findByRole('button', { name: /Grace Achieng/ });
    expect(row).toHaveTextContent('ACT ID rhd00008');
    expect(await within(row).findByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('1 search results')).toBeInTheDocument();
  });

  it('finds a patient by ACT ID', async () => {
    renderPanel();

    await userEvent.type(search(), 'rhd00008');

    expect(await screen.findByRole('button', { name: /Grace Achieng/ })).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    renderPanel();

    await userEvent.type(search(), 'nobody');

    expect(await screen.findByText('Sorry, no patient charts were found')).toBeInTheDocument();
    expect(screen.getByText('0 search results')).toBeInTheDocument();
  });

  it('closes on Escape and on its close button', async () => {
    const { onClose } = renderPanel();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Close search' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("opens a picked patient's chart and puts them first in recently viewed", async () => {
    const { onClose } = renderPanel();
    await userEvent.type(search(), 'Grace');

    await userEvent.click(await screen.findByRole('button', { name: /Grace Achieng/ }));

    expect(navigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/grace/chart/Patient Summary' });
    expect(onClose).toHaveBeenCalled();
    await waitFor(() =>
      expect(posted).toEqual([{ userProperties: { defaultLocale: 'en', patientsVisited: 'grace,esther' } }]),
    );
  });

  it('hands a picked patient to onSelect instead of opening the chart', async () => {
    const onSelect = vi.fn();
    renderPanel({ onSelect });
    await userEvent.type(search(), 'Grace');

    await userEvent.click(await screen.findByRole('button', { name: /Grace Achieng/ }));

    expect(onSelect).toHaveBeenCalledWith(grace);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('counts every match and asks for more of the name when there are more than it lists', async () => {
    searchTotal = 25;
    renderPanel();

    await userEvent.type(search(), 'Grace');

    expect(await screen.findByText('25 search results')).toBeInTheDocument();
    expect(
      screen.getByText('Showing the first 10. Add more of the name, or the ACT ID, to find the others.'),
    ).toBeInTheDocument();
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => /limit=10&totalCount=true/.test(url))).toBe(true);
  });

  it('says the search failed rather than that no patient exists', async () => {
    const serveDefault = vi.mocked(openmrsFetch).getMockImplementation();
    vi.mocked(openmrsFetch).mockImplementation(((url: string, init?: object) =>
      url.includes('/patient?q=') ? Promise.reject(new Error('Network down')) : serveDefault(url, init)) as never);
    renderPanel();

    await userEvent.type(search(), 'Grace');

    expect(await screen.findByText('Could not search for patients')).toBeInTheDocument();
    expect(screen.queryByText('Sorry, no patient charts were found')).not.toBeInTheDocument();
  });

  it('marks a dose due soon as up to date', async () => {
    statusOf.esther = 'dueSoon';
    renderPanel();

    const row = await screen.findByRole('button', { name: /Esther Nambi/ });
    expect(await within(row).findByText('Up to date')).toBeInTheDocument();
    statusOf.esther = 'ok';
  });

  it('keeps listing recently viewed patients, and searches nothing, for one character', async () => {
    renderPanel();

    await userEvent.type(search(), 'G');

    expect(screen.getByText('Recently viewed patients')).toBeInTheDocument();
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => url.includes('/patient?q='))).toBe(false);
  });

  it('gives focus back to what opened it when it closes', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <PatientSearchPanel onClose={onClose} />
      </SWRConfig>,
    );
    search().focus();

    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('stays open, showing the pick is opening, until onSelect settles', async () => {
    let settle: () => void;
    const onSelect = vi.fn(() => new Promise<void>((resolve) => (settle = resolve)));
    const { onClose } = renderPanel({ onSelect });
    await userEvent.type(search(), 'Grace');

    await userEvent.click(await screen.findByRole('button', { name: /Grace Achieng/ }));

    expect(screen.getByText('Opening their chart')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // Every row waits, so a second pick cannot open a second chart.
    expect(screen.getByRole('button', { name: /Grace Achieng/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Grace Achieng/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    // Nor can it be closed, as closing would not stop the opening.
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Close search' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => settle());
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps Tab inside the panel, past content that cannot take focus', async () => {
    renderPanel({
      children: (
        <>
          <button type="button">Last stop</button>
          <button type="button" tabIndex={-1}>
            Not a stop
          </button>
        </>
      ),
    });
    visited = '';
    await userEvent.type(search(), 'nobody');
    await screen.findByText('Sorry, no patient charts were found');

    screen.getByRole('button', { name: 'Last stop' }).focus();
    await userEvent.tab();
    expect(search()).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Last stop' })).toHaveFocus();
  });

  it('records no recently viewed patient before it has the properties it must keep', async () => {
    const serveDefault = vi.mocked(openmrsFetch).getMockImplementation();
    vi.mocked(openmrsFetch).mockImplementation(((url: string, init?: object) =>
      url.includes('/user/') && !init ? new Promise(() => {}) : serveDefault(url, init)) as never);
    renderPanel();
    await userEvent.type(search(), 'Grace');

    await userEvent.click(await screen.findByRole('button', { name: /Grace Achieng/ }));

    expect(posted).toEqual([]);
  });
});
