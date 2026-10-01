import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectItem } from '@carbon/react';

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<string>;
  onChange: (value: string) => void;
  /** The text an option shows, when it differs from its value. */
  optionLabel?: (option: string) => string;
}

/** A filter with an All choice and the given options. */
export function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  optionLabel = (option) => option,
}: FilterSelectProps) {
  const { t } = useTranslation();
  return (
    <Select id={id} labelText={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <SelectItem value="" text={t('all', 'All')} />
      {/* A value from a bookmarked URL that no longer matches still shows, so it can be cleared. */}
      {[...options, ...(value && !options.includes(value) ? [value] : [])].map((option) => (
        <SelectItem key={option} value={option} text={optionLabel(option)} />
      ))}
    </Select>
  );
}
