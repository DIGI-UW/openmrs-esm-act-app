import { useMemo } from 'react';
import useSWR from 'swr';
import { type LoggedInUser, openmrsFetch, restBaseUrl, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type ReportRow } from './reports/report-dataset.resource';

/** The user property holding the clinics on a user's account, as location uuids separated by commas (ACT Core). */
export const CLINICS_PROPERTY = 'actcore.clinics';

/** Held by the instance and global administrators, who work with every clinic. */
export const ALL_CLINICS_PRIVILEGE = 'Task: act.allClinics';

/** The report columns that name a patient's clinics, or a row's clinic, by location name. */
const clinicColumns = ['cardiac_clinic', 'primary_care_clinic', 'facility'] as const;

/** The location uuids in a clinics property value, without blanks or repeats. */
export function parseClinics(value: string | null | undefined): Array<string> {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((clinic) => clinic.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Whether the user is an administrator limited to the clinics on their account, as ACT Core holds them: they may add
 * or edit users and do not hold Task: act.allClinics. In ACT, the site administrator.
 */
export function isClinicLimited(user: LoggedInUser | null | undefined) {
  if (!user) {
    return false;
  }
  const administersUsers = userHasAccess('Edit Users', user) || userHasAccess('Add Users', user);
  return administersUsers && !userHasAccess(ALL_CLINICS_PRIVILEGE, user);
}

export type ClinicLimit =
  | { status: 'none' }
  | { status: 'pending' }
  | { status: 'ready'; uuids: Array<string>; names: Array<string> };

/**
 * The clinics a limited administrator is held to, by uuid and by name as the reports name them; 'none' for anyone
 * else. As in ACT 2.0, a site administrator sees the patients of its own clinics only.
 */
export function useClinicLimit(): ClinicLimit {
  const { user } = useSession();
  const limited = isClinicLimited(user);
  const uuids = useMemo(
    () => (limited ? parseClinics(user?.userProperties?.[CLINICS_PROPERTY]) : []),
    [limited, user?.userProperties],
  );
  const { data, error } = useSWR(limited && uuids.length ? ['act-clinic-limit', ...uuids] : null, () =>
    Promise.all(
      uuids.map((uuid) =>
        openmrsFetch<{ display: string }>(`${restBaseUrl}/location/${uuid}?v=custom:(display)`).then(
          ({ data: location }) => location.display,
        ),
      ),
    ),
  );
  return useMemo((): ClinicLimit => {
    if (!limited) {
      return { status: 'none' };
    }
    if (!uuids.length) {
      // An account with no clinic sees no clinic's patients, as ACT Core lets it see no other user.
      return { status: 'ready', uuids, names: [] };
    }
    if (!data && !error) {
      return { status: 'pending' };
    }
    // A clinic that cannot be named matches no row, so a failure shows fewer patients, never more.
    return { status: 'ready', uuids, names: data ?? [] };
  }, [limited, uuids, data, error]);
}

/**
 * The rows of the clinics a limited administrator is held to: those whose cardiac clinic, primary care clinic or
 * facility is one of them. A report with none of those columns, such as a count, is left as it is.
 */
export function limitRows(rows: Array<ReportRow>, limit: ClinicLimit) {
  if (limit.status === 'none') {
    return rows;
  }
  if (limit.status === 'pending') {
    return [];
  }
  return rows.filter((row) => {
    const columns = clinicColumns.filter((column) => column in row);
    return !columns.length || columns.some((column) => limit.names.includes(String(row[column] ?? '')));
  });
}
