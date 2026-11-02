import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import AnaphylaxisAlert from './anaphylaxis-alert.component';

const serve = (summary: Record<string, unknown>) =>
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: { type: 'BPG', status: 'overdue', nextDue: '2026-10-01', ...summary },
  } as never);

const renderAlert = (patient?: fhir.Patient) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AnaphylaxisAlert patientUuid="kato" patient={patient} />
    </SWRConfig>,
  );

const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('the patient banner anaphylaxis alert', () => {
  it('says anaphylaxis after BPG and BPG on hold, in red, while no consultation has reviewed it', async () => {
    serve({ bpgOnHold: true });

    renderAlert();

    const alert = await screen.findByTestId('anaphylaxis-alert');
    expect(alert).toHaveTextContent('Anaphylaxis after BPG: BPG on hold');
    expect(alert).toHaveClass('cds--tag--red');
    expect(
      screen.getByTitle('Anaphylaxis reported after BPG: a clinician must review before the next dose'),
    ).toContainElement(alert);
    expect(vi.mocked(openmrsFetch)).toHaveBeenCalledWith(
      expect.stringMatching(/\/actcore\/prophylaxis\?patient=kato$/),
    );
  });

  it.each([
    ['once a consultation has reviewed it', { bpgOnHold: false }],
    ['from an ACT Core that does not say', {}],
  ])('shows nothing %s', async (_, summary) => {
    serve(summary);

    const { container } = renderAlert();
    await settled();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing for a deceased patient, without asking', async () => {
    vi.mocked(openmrsFetch).mockClear();
    serve({ bpgOnHold: true });

    const { container } = renderAlert({ resourceType: 'Patient', deceasedBoolean: true });
    await settled();

    expect(container).toBeEmptyDOMElement();
    expect(vi.mocked(openmrsFetch)).not.toHaveBeenCalled();
  });
});
