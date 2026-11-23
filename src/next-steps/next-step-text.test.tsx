import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import { type NextStep } from './next-steps.resource';
import { stepIdentity, useNextStepText } from './next-step-text';

const overdue: NextStep = {
  key: 'bpg',
  form: 'bpg-form',
  title: 'Give BPG injection',
  reason: 'Overdue: was due 03-Oct-2026',
  titleCode: 'actcore.nextStep.title.bpg',
  reasonCode: 'actcore.nextStep.reason.overdue',
  reasonArgs: ['2026-10-03'],
  isNew: false,
  done: false,
};

function text() {
  return renderHook(() => useNextStepText()).result.current;
}

describe('useNextStepText', () => {
  it('writes a coded reason from its code, with the date in the user format', () => {
    const shown = formatDate(parseDate('2026-10-03'), { time: false });

    expect(text().reason(overdue)).toBe(`Overdue: was due ${shown}`);
    expect(text().title(overdue)).toBe('Give BPG injection');
  });

  it('fills in counts and two values', () => {
    expect(
      text().reason({ ...overdue, reasonCode: 'actcore.nextStep.reason.dueInDays', reasonArgs: [2], reason: 'x' }),
    ).toBe('Due in 2 days');
    expect(
      text().reason({
        ...overdue,
        reasonCode: 'actcore.nextStep.reason.lowAdherenceSwitch',
        reasonArgs: [80],
        reason: 'x',
      }),
    ).toBe('Oral adherence below 80%: consider switching to BPG');
  });

  it('shows the server text for a code it does not know, or when ACT Core sends no code', () => {
    expect(
      text().reason({ ...overdue, reasonCode: 'actcore.nextStep.reason.somethingNew', reason: 'Server text' }),
    ).toBe('Server text');
    const older = {
      ...overdue,
      titleCode: undefined,
      reasonCode: undefined,
      reasonArgs: undefined,
      title: 'Old title',
    };
    expect(text().reason(older)).toBe('Overdue: was due 03-Oct-2026');
    expect(text().title(older)).toBe('Old title');
  });
});

describe('stepIdentity', () => {
  it('tells steps apart by code and values, not by the text the server wrote', () => {
    expect(stepIdentity(overdue)).toBe(stepIdentity({ ...overdue, reason: 'En retard depuis le 03/10/2026' }));
    expect(stepIdentity(overdue)).not.toBe(stepIdentity({ ...overdue, reasonArgs: ['2026-10-10'] }));
  });
});
