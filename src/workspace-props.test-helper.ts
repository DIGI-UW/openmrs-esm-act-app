import { shallowEqual } from '@openmrs/esm-utils';

/** The framework's rule for whether launching a workspace with these props restores the one already open. */
export const restoresOpenWorkspace = (open: Record<string, unknown> | null, launched: Record<string, unknown> | null) =>
  open == null || launched == null || shallowEqual(open, launched);
