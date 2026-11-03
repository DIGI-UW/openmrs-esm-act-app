import React, { useEffect, useRef } from 'react';
import { TextInput } from '@carbon/react';
import { useConfig, usePatient } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { allergiesText, allergiesUnavailable, useAllergies } from './allergies.resource';

interface ControlProps {
  field: { id: string; label?: string };
  value: string;
  setFieldValue: (value: string) => void;
}

/**
 * The consultation form's Current allergies: the line the form calculated as it opened, updated when an allergy is
 * saved while the consultation is open, so the penicillin warning reads it.
 */
export default function CurrentAllergies({ field, value, setFieldValue }: ControlProps) {
  // Inside the forms app, the config is read by this app's name.
  const config = useConfig<Config>({ externalModuleName: '@act-registry/esm-act-app' });
  const { patientUuid } = usePatient();
  const { current, error, isLoading } = useAllergies(patientUuid, config);
  const text = !patientUuid || isLoading ? null : error ? allergiesUnavailable : allergiesText(current);
  const lastRead = useRef<string | null>(null);

  useEffect(() => {
    // A refresh that fails keeps the line already read, so the penicillin warning it drives stays shown.
    if (text === null || (error && lastRead.current !== null)) {
      return;
    }
    // Setting the value marks the form changed: pass on only a later change, or a fix for a failed line.
    const changed = lastRead.current !== null && text !== lastRead.current;
    if (text !== value && (changed || value === allergiesUnavailable)) {
      setFieldValue(text);
    }
    lastRead.current = text;
  }, [text, error, value, setFieldValue]);

  return <TextInput id={field.id} labelText={field.label ?? ''} value={value ?? ''} readOnly />;
}
