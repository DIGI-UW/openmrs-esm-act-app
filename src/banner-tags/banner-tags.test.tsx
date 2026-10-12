import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { consultations, inrReview, respondWithEncounters } from '../chart.fixture';
import {
  CardiologyVisitTag,
  ConfirmatoryEchoTag,
  InrTag,
  PrescriptionTag,
  ProceduralRecommendationTag,
} from './banner-tags.component';

const cardiologyFlag = 'b1f7a2c0-0016-4a00-9000-000000000016';
const inrFlag = 'b1f7a2c0-0017-4a00-9000-000000000017';
const screenPositiveReport = 'e3b8f7a2-6c41-4d9e-8a57-1f0c2d4b9e63';
const waitingListReport = '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10';

let flags: Array<string>;
let screenPositive: Array<object>;
let waitingList: Array<object>;
let prophylaxis: object;

const raised = (uuids: Array<string>) => ({
  results: uuids.map((uuid) => ({ voided: false, flag: { uuid, display: uuid } })),
});
const dataset = (rows: Array<object>) => ({ dataSets: [{ metadata: { columns: [] }, rows }] });

function respond() {
  respondWithEncounters({ consultation: consultations, inr: [inrReview] }, (url) => {
    if (url.includes('/patientflags/patientflag')) {
      return raised(flags);
    }
    if (url.includes(`/reportdata/${screenPositiveReport}`)) {
      return dataset(screenPositive);
    }
    if (url.includes(`/reportdata/${waitingListReport}`)) {
      return dataset(waitingList);
    }
    if (url.includes('/actcore/prophylaxis')) {
      return prophylaxis;
    }
    return { results: [] };
  });
}

const onChart = { patientUuid: 'winnie', renderedFrom: 'patient-chart' };

function renderIn(element: React.ReactElement) {
  return render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>{element}</SWRConfig>);
}

async function settled() {
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const tag = () => screen.getByTestId('banner-tag');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // Winnie's next cardiology review was 14 Apr 2026 and her next INR is due 1 Oct 2026.
  vi.setSystemTime(new Date('2026-09-20T08:00:00'));
  vi.mocked(openmrsFetch).mockClear();
  await signInWith(['Get Encounters', 'Get Observations', 'Run Reports']);
  flags = [];
  screenPositive = [];
  waitingList = [];
  prophylaxis = { type: 'BPG', regimen: 'Q28 day BPG', intervalDays: 28, status: 'ok', nextDue: '2026-10-01' };
  respond();
});

afterEach(() => vi.useRealTimers());

describe('Cardiology visit tag', () => {
  it('says overdue once the next review has passed, while the patient has the cardiology follow-up flag', async () => {
    flags = [cardiologyFlag];
    renderIn(<CardiologyVisitTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('Cardiology visit overdue'));
    expect(tag()).toHaveClass('cds--tag--red');
  });

  it('says due before the next review', async () => {
    flags = [cardiologyFlag];
    vi.setSystemTime(new Date('2026-04-01T08:00:00'));
    renderIn(<CardiologyVisitTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('Cardiology visit due'));
  });

  it('says due, not overdue, on the day of the next review', async () => {
    flags = [cardiologyFlag];
    vi.setSystemTime(new Date('2026-04-14T15:00:00'));
    renderIn(<CardiologyVisitTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('Cardiology visit due'));
  });

  it('shows nothing without the flag, whatever the dates', async () => {
    flags = [inrFlag];
    const { container } = renderIn(<CardiologyVisitTag {...onChart} />);

    await settled();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing on a banner outside the chart, such as a search result, without asking', async () => {
    flags = [cardiologyFlag];
    const { container } = renderIn(<CardiologyVisitTag patientUuid="winnie" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container).toBeEmptyDOMElement();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });
});

describe('Banner tags for a deceased patient', () => {
  it.each([
    ['Cardiology visit', CardiologyVisitTag],
    ['INR', InrTag],
    ['Confirmatory echo', ConfirmatoryEchoTag],
    ['Prescription', PrescriptionTag],
    ['Procedural recommendation', ProceduralRecommendationTag],
  ])('shows no %s tag, without asking', async (_, BannerTag) => {
    flags = [cardiologyFlag, inrFlag];
    screenPositive = [{ patient_uuid: 'winnie' }];
    const { container } = renderIn(
      <BannerTag {...onChart} patient={{ resourceType: 'Patient', deceasedBoolean: true }} />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container).toBeEmptyDOMElement();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });
});

describe('INR tag', () => {
  it('says INR due before the Next INR Date, while the patient has the INR review flag', async () => {
    flags = [inrFlag];
    renderIn(<InrTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('INR due'));
  });

  it('says INR due, not overdue, on the Next INR Date', async () => {
    flags = [inrFlag];
    vi.setSystemTime(new Date('2026-10-01T15:00:00'));
    renderIn(<InrTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('INR due'));
  });

  it('says INR overdue once the Next INR Date has passed', async () => {
    flags = [inrFlag];
    vi.setSystemTime(new Date('2026-10-02T08:00:00'));
    renderIn(<InrTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('INR overdue'));
    expect(tag()).toHaveClass('cds--tag--red');
  });

  it('shows nothing without the flag', async () => {
    flags = [cardiologyFlag];
    const { container } = renderIn(<InrTag {...onChart} />);

    await settled();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Confirmatory echo tag', () => {
  it('says Confirmatory echo needed for a patient on the Screen Positive, Pending Confirmation list', async () => {
    screenPositive = [{ patient_uuid: 'someone-else' }, { patient_uuid: 'winnie' }];
    renderIn(<ConfirmatoryEchoTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('Confirmatory echo needed'));
  });

  it('reads the list once, not again for the next chart opened', async () => {
    screenPositive = [{ patient_uuid: 'winnie' }];
    const cache = new Map();
    const chart = () => (
      <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>
        <ConfirmatoryEchoTag {...onChart} />
      </SWRConfig>
    );
    const first = render(chart());
    await waitFor(() => expect(tag()).toHaveTextContent('Confirmatory echo needed'));
    first.unmount();

    render(chart());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const evaluations = vi
      .mocked(openmrsFetch)
      .mock.calls.filter(([url]) => String(url).includes(`/reportdata/${screenPositiveReport}`));
    expect(evaluations).toHaveLength(1);
  });

  it('shows nothing for a patient not on it', async () => {
    screenPositive = [{ patient_uuid: 'someone-else' }];
    const { container } = renderIn(<ConfirmatoryEchoTag {...onChart} />);

    await settled();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Prescription tag', () => {
  it('says Prophylaxis prescribed for a patient with a regimen', async () => {
    renderIn(<PrescriptionTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('Prophylaxis prescribed'));
  });

  it('says No prophylaxis prescription for a patient with none in force', async () => {
    prophylaxis = { type: null, regimen: null, intervalDays: null, status: 'none', nextDue: null };
    renderIn(<PrescriptionTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('No prophylaxis prescription'));
  });
});

describe('Procedural recommendation tag', () => {
  it.each([
    [[{ patient_uuid: 'winnie', date_added: '2026-03-01' }], 'Procedure recommended < 12 months'],
    // The oldest pending recommendation decides how long the patient has waited.
    [
      [
        { patient_uuid: 'winnie', date_added: '2026-03-01' },
        { patient_uuid: 'winnie', date_added: '2025-08-01' },
      ],
      'Procedure recommended > 12 months',
    ],
    [[{ patient_uuid: 'someone-else', date_added: '2025-01-01' }], 'No procedural recommendation'],
  ])('reads the procedural waiting list (%j) as %s', async (rows, label) => {
    waitingList = rows;
    renderIn(<ProceduralRecommendationTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent(label));
  });
});
