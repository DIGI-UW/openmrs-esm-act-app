import dayjs from 'dayjs';
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

describe('useNextStepText for every code ACT Core sends', () => {
  const reasons: Array<[string, Array<string | number>, string]> = [
    ['anaphylaxisReview', [], 'Anaphylaxis reported after BPG: review before the next dose'],
    ['anaphylaxisReferral', [], 'Anaphylaxis reported: a clinician must review before the next dose'],
    ['deliveryOverdue', [], 'Delivery outcome overdue'],
    ['dueInDays', [5], 'Due in 5 days'],
    ['dueToday', [], 'Due today'],
    ['dueTomorrow', [], 'Due tomorrow'],
    ['echoOverdue', [12, '2025-01-02'], 'Last echo was over 12 months ago (02-Jan-2025)'],
    ['enteredThisVisit', [], 'Entered this visit'],
    ['followUpDue', [], '30-day follow-up due'],
    ['inrDue', [], 'INR review due'],
    ['inrDueOn', ['2026-12-01'], 'INR review due 01-Dec-2026'],
    ['inrOverdue', ['2026-10-03'], 'INR review overdue: was due 03-Oct-2026'],
    ['lowAdherenceReview', [80], 'Oral adherence below 80%: a clinician to review the plan'],
    ['lowAdherenceSwitch', [80], 'Oral adherence below 80%: consider switching to BPG'],
    ['noEcho', [], 'No echocardiogram recorded'],
    ['notPrescribed', [], 'No prophylaxis prescribed'],
    ['notPrescribedReferral', [], 'No prophylaxis prescribed: a clinician to prescribe'],
    ['onHoldConsult', [], 'On hold: complete the consultation before giving BPG'],
    ['onHoldReview', [], 'On hold: a clinician must review before the next dose'],
    ['overdue', ['2026-10-03'], 'Overdue: was due 03-Oct-2026'],
    ['patientInfoNotRecorded', [], 'Patient Information not recorded'],
    ['referralSent', [], 'Referral sent: a clinician to review'],
    ['reviewEcho', [], 'Review the new echo result and update the care plan'],
  ];

  it.each(reasons)('writes reason %s from its code', (code, reasonArgs, english) => {
    expect(
      text().reason({ ...overdue, reason: 'server', reasonCode: `actcore.nextStep.reason.${code}`, reasonArgs }),
    ).toBe(english);
  });

  const titles: Array<[string, string]> = [
    ['bpg', 'Give BPG injection'],
    ['oral', 'Record oral prophylaxis visit'],
    ['consult', 'Consultation visit'],
    ['echo', 'Echocardiogram'],
    ['procedures', 'Procedures and outcomes'],
    ['inr', 'INR review'],
    ['patientInfo', 'Patient Information'],
    ['pregnancy', 'Pregnancy'],
    ['refer', 'Refer to clinician'],
  ];

  it.each(titles)('writes title %s from its code', (key, english) => {
    expect(text().title({ ...overdue, key, title: 'server', titleCode: `actcore.nextStep.title.${key}` })).toBe(
      english,
    );
  });

  it('writes a date that falls today as the date, not as the word Today', () => {
    const today = dayjs().format('YYYY-MM-DD');

    expect(
      text().reason({ ...overdue, reasonCode: 'actcore.nextStep.reason.inrDueOn', reasonArgs: [today], reason: 'x' }),
    ).toBe(`INR review due ${dayjs().format('DD-MMM-YYYY')}`);
  });
});

describe('stepIdentity', () => {
  it('tells steps apart by code and values, not by the text the server wrote', () => {
    expect(stepIdentity(overdue)).toBe(stepIdentity({ ...overdue, reason: 'En retard depuis le 03/10/2026' }));
    expect(stepIdentity(overdue)).not.toBe(stepIdentity({ ...overdue, reasonArgs: ['2026-10-10'] }));
  });
});
