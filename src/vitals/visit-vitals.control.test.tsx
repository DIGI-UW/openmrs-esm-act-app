import React from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  getConfig,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  restBaseUrl,
  useConfig,
  usePatient,
} from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { fetchVisitVitalsText, type VisitObs, vitalsNotRecorded } from './visit-vitals.resource';
import VisitVitals from './visit-vitals.control';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-framework')>()),
  getConfig: vi.fn(),
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const obs = (concept: string, value: unknown): VisitObs => ({
  concept: { uuid: concept },
  value,
  obsDatetime: '2026-11-19T09:00:00.000+0300',
});
const bloodPressure = [
  obs('5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 120),
  obs('5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 80),
];
const recorded = 'Vitals at this visit: BP 120/80 mmHg';

let visits: Record<string, Array<VisitObs>> = {};
const field = { id: 'current_vitals', label: 'Vitals at this visit', questionOptions: {} } as never;
let revalidateVisits: () => Promise<unknown>;
let renderAgain: () => void;

// As the stock vitals form's save does, through esm-patient-common-lib's invalidateVisits.
function Revalidator() {
  const { mutate } = useSWRConfig();
  revalidateVisits = () => mutate((key) => typeof key === 'string' && key.includes(`${restBaseUrl}/visit/`));
  return null;
}

const visitFetches = () => vi.mocked(openmrsFetch).mock.calls.filter(([url]) => String(url).includes('/visit/'));

// The form engine runs the field's calculate before it renders the field.
const openConsultation = async (visitUuid: string | undefined, beforeRender = () => {}) => {
  const value = await fetchVisitVitalsText('abebe', visitUuid);
  beforeRender();
  const setFieldValue = vi.fn();
  const provider = new Map();
  const form = () => (
    <SWRConfig value={{ provider: () => provider, dedupingInterval: 0 }}>
      <Revalidator />
      <VisitVitals field={field} value={value} setFieldValue={setFieldValue} />
    </SWRConfig>
  );
  const { rerender } = render(form());
  renderAgain = () => rerender(form());
  return setFieldValue;
};

describe('the consultation form’s Vitals at this visit', () => {
  beforeEach(() => {
    visits = {};
    vi.mocked(getConfig).mockResolvedValue(config as never);
    vi.mocked(useConfig).mockReturnValue(config);
    vi.mocked(usePatient).mockReturnValue({
      patientUuid: 'abebe',
      patient: null,
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
      const visit = /\/visit\/([^?]+)\?/.exec(url)?.[1];
      return { data: { encounters: [{ obs: visits[visit] ?? [] }] } };
    }) as never);
  });

  it('shows the line the form calculated when it opened, and leaves the form untouched while it agrees', async () => {
    const setFieldValue = await openConsultation('today');

    expect(screen.getByLabelText('Vitals at this visit')).toHaveValue(vitalsNotRecorded);
    await waitFor(() => expect(visitFetches().length).toBeGreaterThan(1));
    await act(() => revalidateVisits());
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('leaves the form untouched on its first read, even when that differs from the line the form calculated', async () => {
    const setFieldValue = await openConsultation('today', () => {
      visits.today = bloodPressure;
    });

    await waitFor(() => expect(visitFetches().length).toBeGreaterThan(1));
    await act(() => revalidateVisits());
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('tells the form when vitals are recorded in its visit while the consultation is open', async () => {
    const setFieldValue = await openConsultation('today');
    await waitFor(() => expect(visitFetches().length).toBeGreaterThan(1));

    visits.today = bloodPressure;
    await act(() => revalidateVisits());

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith(recorded));
    expect(setFieldValue).toHaveBeenCalledTimes(1);
  });

  it('reads the visit the consultation opened in, not one opened before it', async () => {
    await fetchVisitVitalsText('abebe', 'today');
    const setFieldValue = await openConsultation('last-month');
    await waitFor(() => expect(visitFetches().some(([url]) => String(url).includes('/visit/last-month?'))).toBe(true));

    visits.today = bloodPressure;
    await act(() => revalidateVisits());

    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('keeps reading its own visit when the chart shows a past consultation beside it', async () => {
    const setFieldValue = await openConsultation('today');
    await waitFor(() => expect(visitFetches().length).toBeGreaterThan(1));

    // The visits table renders a past consultation, whose calculate runs the helper for its own visit.
    await fetchVisitVitalsText('abebe', 'last-month');
    visits['last-month'] = bloodPressure;
    renderAgain();
    await act(() => revalidateVisits());

    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('reads no visit for a consultation outside one, even after one opened in a visit', async () => {
    await fetchVisitVitalsText('abebe', 'today');
    vi.mocked(openmrsFetch).mockClear();
    const setFieldValue = await openConsultation(undefined);

    visits.today = bloodPressure;
    await act(() => revalidateVisits());

    expect(visitFetches()).toEqual([]);
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it("replaces the form's failed line with the vitals it reads", async () => {
    vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error('offline'));
    visits.today = bloodPressure;
    const setFieldValue = await openConsultation('today');

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith(recorded));
  });

  it('keeps the line it read when a later refresh fails', async () => {
    visits.today = bloodPressure;
    const setFieldValue = await openConsultation('today');
    await waitFor(() => expect(visitFetches().length).toBeGreaterThan(1));

    vi.mocked(openmrsFetch).mockRejectedValue(new Error('offline'));
    await act(() => revalidateVisits());

    expect(setFieldValue).not.toHaveBeenCalled();
  });
});
