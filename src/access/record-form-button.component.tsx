import React from 'react';
import { Button } from '@carbon/react';
import { AddIcon } from '@openmrs/esm-framework';
import { MayEnterForm } from './may-enter-form';

interface RecordFormButtonProps {
  form: string;
  label: string;
  /** The opener the card's buttons share, so opening one form holds them all until it is open. */
  opener: { open: (form: string) => void; isOpening: boolean };
}

/** A summary card's action to record a form, for a user who may record it. */
export function RecordFormButton({ form, label, opener }: RecordFormButtonProps) {
  return (
    <MayEnterForm formUuid={form}>
      <Button
        kind="ghost"
        size="sm"
        renderIcon={(props) => <AddIcon size={16} {...props} />}
        disabled={opener.isOpening}
        onClick={() => opener.open(form)}
      >
        {label}
      </Button>
    </MayEnterForm>
  );
}
