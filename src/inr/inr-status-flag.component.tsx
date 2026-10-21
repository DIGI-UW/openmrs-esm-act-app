import React from 'react';
import { pillsClassName } from '../patient-status/status-pill.component';
import { InrPill } from '../patient-status/status-pills.component';
import { useInrReviews } from './inr.resource';

/** The patient banner's INR pill, for a living patient on warfarin whose next INR is due or overdue. */
export default function InrStatusFlag({ patientUuid, patient }: { patientUuid: string; patient?: fhir.Patient }) {
  const deceased = Boolean(patient?.deceasedBoolean || patient?.deceasedDateTime);
  const { onWarfarin, nextInr } = useInrReviews(deceased ? null : patientUuid);
  if (deceased || !onWarfarin) {
    return null;
  }
  return (
    <span className={pillsClassName}>
      <InrPill nextInr={nextInr} />
    </span>
  );
}
