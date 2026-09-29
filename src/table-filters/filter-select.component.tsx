import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectItem } from '@carbon/react';

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  options: Array<string>;
  onChange: (value: string) => void;
}

/** A filter with an All choice and the given options. */
export function FilterSelect({ id, label, value, options, onChange }: FilterSelectProps) {
  const { t } = useTranslation();
  return (
    <Select id={id} labelText={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <SelectItem value="" text={t('all', 'All')} />
      {/* A value from a bookmarked URL that no longer matches still shows, so it can be cleared. */}
      {[...options, ...(value && !options.includes(value) ? [value] : [])].map((option) => (
        <SelectItem key={option} value={option} text={option} />
      ))}
    </Select>
  );
}
