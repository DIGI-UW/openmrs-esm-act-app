import React from 'react';
import useSWRImmutable from 'swr/immutable';
import { type LoggedInUser, userHasAccess, useSession } from '@openmrs/esm-framework';
import { PRIVILEGE_ADD_ENCOUNTERS } from '../constants';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';

/** Whether the user holds Add Encounters and the edit privilege of the form's encounter type, if it has one. */
export function mayEnter(
  form: { encounterType?: { editPrivilege?: { display: string } | null } | null },
  user: LoggedInUser,
) {
  return userHasAccess([PRIVILEGE_ADD_ENCOUNTERS, form.encounterType?.editPrivilege?.display].filter(Boolean), user);
}

/**
 * Whether the user may record the form: Add Encounters and, as the patient chart's forms list checks, the edit
 * privilege of the form's encounter type, which the server enforces on save.
 */
export function useMayEnterForm(formUuid: string) {
  const { user } = useSession();
  const { data: form } = useSWRImmutable(formUuid ? ['act-form', formUuid] : null, () => fetchForm(formUuid));
  return Boolean(user && form) && mayEnter(form, user);
}

/** Renders its children only for a user who may record the form. */
export function MayEnterForm({ formUuid, children }: { formUuid: string; children: React.ReactNode }) {
  return useMayEnterForm(formUuid) ? <>{children}</> : null;
}
