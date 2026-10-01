import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import ProphylaxisStatusTag from './prophylaxis-status-tag.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

function summary(status: string | null) {
  return {
    regimen: 'Q21 day BPG',
    type: 'BPG',
    intervalDays: 21,
    lastGiven: '2026-08-22',
    nextDue: '2026-09-12',
    status,
    onTime: { given: 3, total: 4, months: 6 },
  };
}

function respondWith(status: string | null) {
  mockOpenmrsFetch.mockResolvedValue({ data: summary(status) } as never);
}

const patientUuid = 'patient-uuid';

// A cache per render keeps one test's answer out of the next; the 1 ms interval lets a retry happen in a test.
function renderTag(patient?: fhir.Patient) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), errorRetryInterval: 1 }}>
      <ProphylaxisStatusTag patientUuid={patientUuid} patient={patient} />
    </SWRConfig>,
  );
}

async function settled() {
  await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ProphylaxisStatusTag', () => {
  it('says Overdue in red for an overdue patient, asking about that patient', async () => {
    respondWith('overdue');

    renderTag();

    const tag = await screen.findByTestId('prophylaxis-status');
    expect(tag).toHaveTextContent('Overdue');
    expect(tag).toHaveClass('cds--tag--red');
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/actcore/prophylaxis\\?patient=${patientUuid}$`)),
    );
  });

  it('says Due today in blue for a dose due today', async () => {
    respondWith('dueToday');

    renderTag();

    const tag = await screen.findByTestId('prophylaxis-status');
    expect(tag).toHaveTextContent('Due today');
    expect(tag).toHaveClass('cds--tag--blue');
  });

  it.each(['dueSoon', 'ok', 'none', null])('shows no tag for a status of %s', async (status) => {
    respondWith(status);

    const { container } = renderTag();
    await settled();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows no tag when the summary cannot be read, asking once', async () => {
    mockOpenmrsFetch.mockRejectedValue(new Error('Privilege required: Get Observations'));

    const { container } = renderTag();
    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(container).toBeEmptyDOMElement();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it.each([{ deceasedBoolean: true }, { deceasedDateTime: '2026-09-01' }])(
    'shows no tag for a deceased patient, without asking (%o)',
    async (deceased) => {
      respondWith('overdue');

      const { container } = renderTag({ resourceType: 'Patient', ...deceased });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container).toBeEmptyDOMElement();
      expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    },
  );
});
