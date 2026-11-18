import React, { useEffect, useRef, useState } from 'react';
import { TextInput } from '@carbon/react';
import { useConfig, usePatient } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { consultationVisitUuid, useVisitVitals, vitalsUnavailable } from './visit-vitals.resource';

interface ControlProps {
  field: { id: string; label?: string };
  value: string;
  setFieldValue: (value: string) => void;
}

/**
 * The consultation form's Vitals at this visit: the line the form calculated as it opened, updated when vitals are
 * recorded in its visit while the consultation is open, so Record vitals hides.
 */
export default function VisitVitals({ field, value, setFieldValue }: ControlProps) {
  // Inside the forms app, the config is read by this app's name.
  const { consultations } = useConfig<Config>({ externalModuleName: '@act-registry/esm-act-app' });
  const { patientUuid } = usePatient();
  // Read once: a past consultation the chart shows inline runs the helper again, for its own visit.
  const [visitUuid] = useState(() => (patientUuid ? consultationVisitUuid(patientUuid) : undefined));
  const text = useVisitVitals(visitUuid, consultations.vitals);
  const lastRead = useRef<string | null>(null);

  useEffect(() => {
    if (text === null) {
      return;
    }
    // Setting the value marks the form changed: pass on only a later change, or a fix for a failed line.
    const changed = lastRead.current !== null && text !== lastRead.current;
    if (text !== value && (changed || value === vitalsUnavailable)) {
      setFieldValue(text);
    }
    lastRead.current = text;
  }, [text, value, setFieldValue]);

  return <TextInput id={field.id} labelText={field.label ?? ''} value={value ?? ''} readOnly />;
}
