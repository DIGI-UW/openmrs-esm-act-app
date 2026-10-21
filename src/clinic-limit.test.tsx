import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { signInWith } from './access/sign-in.test-helper';
import { ALL_CLINICS_PRIVILEGE, CLINICS_PROPERTY, isClinicLimited, limitRows, parseClinics } from './clinic-limit';
import { useReportDataset } from './reports/report-dataset.resource';

const ACIMI = 'acimi-uuid';
const AKUNA = 'akuna-uuid';

const registryRows = [
  { patient_uuid: 'p1', primary_care_clinic: 'Acimi HCIII', cardiac_clinic: 'Gulu RRH' },
  { patient_uuid: 'p2', primary_care_clinic: 'Akunalaber HCIII', cardiac_clinic: 'Uganda Heart Institute' },
  { patient_uuid: 'p3', primary_care_clinic: 'Kitgum-Matidi HCIII', cardiac_clinic: 'Acimi HCIII' },
  { patient_uuid: 'p4', primary_care_clinic: null, cardiac_clinic: null },
];

/** Signs in a site administrator (Edit Users, no Task: act.allClinics) whose account names these clinics. */
async function signInSiteAdmin(clinics: string | undefined, privileges = ['Edit Users', 'Get Users']) {
  await signInWith(privileges);
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    user: { ...session.user, userProperties: clinics === undefined ? {} : { [CLINICS_PROPERTY]: clinics } },
  } as never);
}

function respond() {
  vi.mocked(openmrsFetch).mockImplementation(((url: string) => {
    if (url.includes(`/location/${ACIMI}?`)) {
      return Promise.resolve({ data: { display: 'Acimi HCIII' } });
    }
    if (url.includes(`/location/${AKUNA}?`)) {
      return Promise.resolve({ data: { display: 'Akunalaber HCIII' } });
    }
    return Promise.resolve({ data: { dataSets: [{ metadata: { columns: [] }, rows: registryRows }] } });
  }) as never);
}

function renderRegistry() {
  const cache = new Map();
  return renderHook(() => useReportDataset('f1a2b3c4-d5e6-7890-abcd-ef1234567890'), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>,
  });
}

describe('clinic limit', () => {
  beforeEach(() => respond());

  it('reads the clinics on an account without blanks or repeats', () => {
    expect(parseClinics(' a, ,b,a ')).toEqual(['a', 'b']);
    expect(parseClinics(undefined)).toEqual([]);
  });

  it('limits an administrator of users who does not hold the all-clinics privilege, and nobody else', async () => {
    await signInWith(['Edit Users']);
    expect(isClinicLimited(vi.mocked(useSession)().user)).toBe(true);
    await signInWith(['Add Users']);
    expect(isClinicLimited(vi.mocked(useSession)().user)).toBe(true);
    await signInWith(['Edit Users', ALL_CLINICS_PRIVILEGE]);
    expect(isClinicLimited(vi.mocked(useSession)().user)).toBe(false);
    await signInWith(['App: act.registry']);
    expect(isClinicLimited(vi.mocked(useSession)().user)).toBe(false);
  });

  it("keeps a limited administrator's report rows to those naming one of their clinics, by either clinic", async () => {
    await signInSiteAdmin(`${ACIMI},${AKUNA}`);

    const { result } = renderRegistry();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows.map((row) => row.patient_uuid)).toEqual(['p1', 'p2', 'p3']);
  });

  it('gives a limited administrator with no clinic on their account no rows', async () => {
    await signInSiteAdmin(undefined);

    const { result } = renderRegistry();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
  });

  it('gives every row to an administrator of every clinic', async () => {
    await signInSiteAdmin(ACIMI, ['Edit Users', ALL_CLINICS_PRIVILEGE]);

    const { result } = renderRegistry();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(4);
  });

  it('leaves rows without clinic columns, such as counts, as they are, and holds back every row while pending', () => {
    const counts = [{ step: 'Active', patients: 4 }];
    expect(limitRows(counts, { status: 'ready', uuids: [ACIMI], names: ['Acimi HCIII'] })).toEqual(counts);
    expect(limitRows(registryRows, { status: 'pending' })).toEqual([]);
    expect(
      limitRows([{ facility: 'Acimi HCIII' }, { facility: 'Lira HCIII' }], {
        status: 'ready',
        uuids: [ACIMI],
        names: ['Acimi HCIII'],
      }),
    ).toEqual([{ facility: 'Acimi HCIII' }]);
  });
});
