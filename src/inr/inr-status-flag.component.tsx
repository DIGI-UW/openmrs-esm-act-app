import React from 'react';
import { pillsClassName } from '../patient-status/status-pill.component';
import { InrPill, InrValuePill } from '../patient-status/status-pills.component';
import { useInrReviews } from './inr.resource';

/**
 * The patient banner's INR pills, for a living patient on warfarin: the next INR when due or overdue, and the
 * latest INR when it is outside its target.
 */
export default function InrStatusFlag({ patientUuid, patient }: { patientUuid: string; patient?: fhir.Patient }) {
  const deceased = Boolean(patient?.deceasedBoolean || patient?.deceasedDateTime);
  const { onWarfarin, nextInr, reviews } = useInrReviews(deceased ? null : patientUuid);
  const latest = reviews.find((review) => review.inr !== null);
  if (deceased || !onWarfarin) {
    return null;
  }
  return (
    <span className={pillsClassName}>
      <InrPill nextInr={nextInr} />
      {latest && <InrValuePill inr={latest.inr} target={latest.target} />}
    </span>
  );
}
