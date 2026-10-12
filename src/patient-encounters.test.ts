import { describe, expect, it } from 'vitest';
import { groupsOf, memberValue } from './patient-encounters';

describe('groupsOf', () => {
  it('takes the members of each group answering the question, and no answer of the same question that is not a group', () => {
    const encounter = {
      uuid: 'inr',
      encounterDatetime: '2026-09-01T10:00:00.000+0000',
      // The INR form records its target and each reading's group under one question.
      obs: [
        { concept: { uuid: 'target' }, value: { uuid: 'range', display: '2.0-3.0' }, groupMembers: null },
        { concept: { uuid: 'target' }, value: null, groupMembers: [{ concept: { uuid: 'inr' }, value: 2.4 }] },
        { concept: { uuid: 'target' }, value: null, groupMembers: [] },
      ],
    };

    const groups = groupsOf(encounter, 'target');

    expect(groups).toHaveLength(1);
    expect(memberValue(groups[0], 'inr')).toBe(2.4);
  });
});
