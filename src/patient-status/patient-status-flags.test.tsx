import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { type ScopedMutator, SWRConfig, useSWRConfig } from 'swr';
import { openmrsFetch, restBaseUrl, showSnackbar } from '@openmrs/esm-framework';
import PatientStatusFlags from './patient-status-flags.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

// Tuesday 13 October 2026, mid-morning.
const NOW = new Date(2026, 9, 13, 10, 0);

function summary(overrides: Record<string, unknown> = {}) {
  return {
    regimen: 'Q21 day BPG',
    type: 'BPG',
    intervalDays: 21,
    lastGiven: '2026-09-22',
    nextDue: '2026-10-13',
    status: 'dueToday',
    onTime: { given: 3, total: 4, months: 6 },
    ...overrides,
  };
}

function respondWith(prophylaxis: Record<string, unknown>, cardiology: string | null = null) {
  mockOpenmrsFetch.mockImplementation((url: string) =>
    Promise.resolve({
      data: url.includes('/actcore/cardiology') ? { nextDue: cardiology } : summary(prophylaxis),
    } as never),
  );
}

const patientUuid = 'patient-uuid';

let mutateCache: ScopedMutator;

function CacheMutator() {
  mutateCache = useSWRConfig().mutate;
  return null;
}

// A cache per render keeps one test's answer out of the next; the 1 ms interval lets a retry happen in a test.
function renderFlags(patient?: fhir.Patient) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), errorRetryInterval: 1 }}>
      <CacheMutator />
      <PatientStatusFlags patientUuid={patientUuid} patient={patient} />
    </SWRConfig>,
  );
}

async function settled() {
  await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const invalidateEncounters = () =>
  // The chart's invalidatePatientEncounters, which the forms app runs after every save.
  mutateCache(
    (key) =>
      typeof key === 'string' && key.includes(`${restBaseUrl}/encounter`) && key.includes(`patient=${patientUuid}`),
  );

describe('PatientStatusFlags', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks about this patient for both dates', async () => {
    respondWith({});

    renderFlags();
    await settled();

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/actcore/prophylaxis\\?patient=${patientUuid}$`)),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/actcore/cardiology\\?patient=${patientUuid}$`)),
    );
  });

  it.each([
    ['2026-10-12', 'red', 'Prophylaxis overdue'],
    ['2026-10-13', 'yellow', 'Prophylaxis due today'],
    ['2026-10-14', 'yellow', 'Prophylaxis due 14 Oct'],
    ['2026-10-15', 'yellow', 'Prophylaxis due 15 Oct'],
    ['2026-10-16', 'green', 'Prophylaxis up to date'],
  ])('colours a dose due %s %s: %s', async (nextDue, tone, label) => {
    respondWith({ nextDue });

    renderFlags();

    const pill = await screen.findByTestId('prophylaxis-status');
    expect(pill).toHaveTextContent(label);
    expect(pill).toHaveAttribute('data-tone', tone);
  });

  it.each([
    ['2026-10-01', 'red', 'Cardiology visit overdue'],
    ['2026-10-13', 'yellow', 'Cardiology visit due today'],
    ['2026-10-15', 'yellow', 'Cardiology visit due 15 Oct'],
    ['2026-10-16', 'green', 'Cardiology visit due 16 Oct'],
    ['2027-01-12', 'green', 'Cardiology visit due 12-Jan-2027'],
  ])('colours a cardiology visit due %s %s: %s', async (nextDue, tone, label) => {
    respondWith({}, nextDue);

    renderFlags();

    const pill = await screen.findByTestId('cardiology-status');
    expect(pill).toHaveTextContent(label);
    expect(pill).toHaveAttribute('data-tone', tone);
  });

  it('shows both pills side by side, as in the banner design', async () => {
    respondWith({ nextDue: '2026-10-13' }, '2026-10-15');

    renderFlags();

    expect(await screen.findByTestId('prophylaxis-status')).toHaveTextContent('Prophylaxis due today');
    expect(await screen.findByTestId('cardiology-status')).toHaveTextContent('Cardiology visit due 15 Oct');
  });

  it.each([
    ['no regimen', { status: 'none', nextDue: null }],
    ['an oral regimen whose supply end is unknown', { type: 'Oral', status: null, nextDue: null }],
  ])('shows no prophylaxis pill for %s', async (_, prophylaxis) => {
    respondWith(prophylaxis);

    renderFlags();
    await settled();

    expect(screen.queryByTestId('prophylaxis-status')).not.toBeInTheDocument();
  });

  it('shows no cardiology pill without a review date', async () => {
    respondWith({});

    renderFlags();
    await screen.findByTestId('prophylaxis-status');

    expect(screen.queryByTestId('cardiology-status')).not.toBeInTheDocument();
  });

  it('turns green when a form save moves the next dose on', async () => {
    respondWith({ nextDue: '2026-10-10' });
    renderFlags();
    expect(await screen.findByTestId('prophylaxis-status')).toHaveAttribute('data-tone', 'red');

    respondWith({ nextDue: '2026-11-03', lastGiven: '2026-10-13' });
    await invalidateEncounters();

    await waitFor(() => expect(screen.getByTestId('prophylaxis-status')).toHaveAttribute('data-tone', 'green'));
  });

  it('shows no pills when neither can be read, asking each once', async () => {
    mockOpenmrsFetch.mockRejectedValue(new Error('Privilege required: Get Observations'));

    renderFlags();
    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByTestId('prophylaxis-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cardiology-status')).not.toBeInTheDocument();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it.each([{ deceasedBoolean: true }, { deceasedDateTime: '2026-09-01' }])(
    'shows nothing for a deceased patient, without asking (%o)',
    async (deceased) => {
      respondWith({ nextDue: '2026-10-01' }, '2026-10-01');

      const { container } = renderFlags({ resourceType: 'Patient', ...deceased });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container).toBeEmptyDOMElement();
      expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    },
  );

  it('says when the next dose is due once a newer BPG dose is saved, and not for the dose on record', async () => {
    respondWith({ status: 'ok', nextDue: '2026-10-20' });
    renderFlags();
    await settled();
    expect(showSnackbar).not.toHaveBeenCalled();

    respondWith({ status: 'ok', lastGiven: '2026-10-03', nextDue: '2026-10-24' });
    await invalidateEncounters();

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'BPG dose recorded', subtitle: 'Next due 24-Oct-2026' }),
      ),
    );
  });
});
