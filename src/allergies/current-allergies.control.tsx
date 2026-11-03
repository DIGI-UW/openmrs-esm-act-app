import React, { useEffect, useRef } from 'react';
import { TextInput } from '@carbon/react';
import { useConfig, usePatient } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { allergiesText, useAllergies } from './allergies.resource';

interface ControlProps {
  field: { id: string; label?: string };
  value: string;
  setFieldValue: (value: string) => void;
}

/**
 * The consultation form's Current allergies: the line the form calculated as it opened, updated when an allergy is
 * saved while the consultation is open, so the penicillin warning reads it. Rendered inside the form engine, so the
 * patient comes from the chart's URL and the config is read by the app's name.
 */
export default function CurrentAllergies({ field, value, setFieldValue }: ControlProps) {
  const config = useConfig<Config>({ externalModuleName: '@act-registry/esm-act-app' });
  const { patientUuid } = usePatient();
  const { current, error, isLoading } = useAllergies(patientUuid, config);
  const text = isLoading ? null : error ? 'Allergies unavailable' : allergiesText(current);
  const lastRead = useRef<string | null>(null);

  useEffect(() => {
    if (text === null) {
      return;
    }
    // Setting the value marks the form changed, so only a change after the form opened is passed on.
    if (lastRead.current !== null && text !== lastRead.current && text !== value) {
      setFieldValue(text);
    }
    lastRead.current = text;
  }, [text, value, setFieldValue]);

  return <TextInput id={field.id} labelText={field.label ?? ''} value={value ?? ''} readOnly />;
}
