import React from 'react';
import { SWRConfig } from 'swr';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, openmrsFetch } from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import ProceduralRecommendationsCard from './procedural-recommendations-card.component';

const open = vi.fn();
vi.mock('../visits/open-form-in-visit', () => ({ useOpenFormInVisit: () => ({ open, isOpening: false }) }));
vi.mock('../access/may-enter-form', () => ({ useMayEnterForm: vi.fn(() => true) }));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const p = config.procedures.concepts;
const NONE = '1107AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SURGERY = coded('aa5fefb0-cf61-5f36-82e6-31dbbdf3f616', 'Surgery');
const CATHETERIZATION = coded('91a4d13f-4bc8-54b0-a107-f4ab84cb7d60', 'Catheterization');
const MITRAL_VALVE = coded('7af8595d-407e-5705-bd8a-812735e2f188', 'Mitral valve repair / replacement');
const AORTIC_VALVE = coded('cd9c582a-71f9-5441-97a8-6d50d7dc15c8', 'Aortic valve repair / replacement');
const BALLOON = coded('af9429ff-1b76-55f3-81ca-a9f775d93fb4', 'Mitral balloon valvuloplasty');
const ELECTIVE = coded('2666bf97-7400-57c7-b535-7903e22ced34', '3: Elective (180 days)');
const URGENT = coded('33bf504a-15f2-5504-9bdc-ddded0b5eb00', '2: Urgent (60 days)');
const EMERGENT = coded('1fe15210-4490-58b0-a38c-bb0386e98482', '1: Emergent (24 hours)');

function coded(uuid: string, display: string) {
  return { uuid, display };
}
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  uuid: `${concept}-${JSON.stringify(value)}`,
  concept: { uuid: concept },
  value,
  groupMembers,
});
const ago = (days: number) => dayjs().subtract(days, 'day').format('YYYY-MM-DD');
const shown = (date: string) => dayjs(date).format('DD-MMM-YYYY');

const recommends = (type: unknown, procedure: unknown, urgency: unknown) =>
  obs(c.recommendation, null, [
    obs(c.procedureType, type),
    ...(procedure ? [obs(c.recommendation, procedure)] : []),
    ...(urgency ? [obs(c.urgency, urgency)] : []),
  ]);

const consultation = (day: string, recommendations: Array<unknown>) =>
  ({
    uuid: `consultation-${day}`,
    encounterDatetime: `${day}T09:00:00.000+0300`,
    obs: recommendations,
  }) as ChartEncounter;

const procedure = (day: string, done: { uuid: string; display: string }) =>
  ({
    uuid: `procedure-${day}`,
    encounterDatetime: `${day}T09:00:00.000+0300`,
    obs: [obs(p.date, `${day}T00:00:00.000+0300`), obs(p.surgeryType, null, [obs(p.surgeryType, done)])],
  }) as ChartEncounter;

function serve(consultations: Array<ChartEncounter>, procedures: Array<ChartEncounter> = []) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
    const results = url.includes(`encounterType=${config.consultations.encounterType}`)
      ? consultations
      : url.includes(`encounterType=${config.procedures.encounterType}`)
        ? procedures
        : [];
    return { data: { results, totalCount: results.length } };
  }) as never);
}

const renderCard = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ProceduralRecommendationsCard patientUuid="grace" />
    </SWRConfig>,
  );

const rowOf = (procedureName: string) =>
  screen.getAllByTestId('procedural-recommendation').find((row) => row.textContent.includes(procedureName));

describe('ProceduralRecommendationsCard', () => {
  beforeEach(async () => {
    open.mockReset();
    vi.mocked(useMayEnterForm).mockReturnValue(true);
    await signInWith(['Get Encounters', 'Get Observations']);
  });

  it("lists the latest consultation's recommendations: waiting, overdue, and done once Procedures and Outcomes records them", async () => {
    serve(
      [
        consultation(ago(10), [
          recommends(SURGERY, MITRAL_VALVE, ELECTIVE),
          recommends(CATHETERIZATION, BALLOON, EMERGENT),
          recommends(SURGERY, AORTIC_VALVE, URGENT),
          recommends(coded(NONE, 'None'), null, null),
        ]),
        consultation(ago(40), [recommends(SURGERY, MITRAL_VALVE, ELECTIVE)]),
      ],
      [procedure(ago(5), AORTIC_VALVE)],
    );

    renderCard();

    await waitFor(() => expect(screen.getAllByTestId('procedural-recommendation')).toHaveLength(3));
    // Recommended at both consultations, so it has waited since the older one.
    const mitral = rowOf('Mitral valve');
    expect(mitral).toHaveTextContent('Surgery');
    // The band's label, which the test's translation leaves as its key.
    expect(mitral).toHaveTextContent('urgencyElective');
    expect(mitral).toHaveTextContent(shown(ago(40)));
    expect(mitral).toHaveTextContent(shown(dayjs(ago(40)).add(180, 'day').format('YYYY-MM-DD')));
    expect(mitral).toHaveTextContent('Waiting');
    const balloon = rowOf('balloon');
    expect(balloon).toHaveTextContent('urgencyEmergent');
    expect(balloon).toHaveTextContent('Overdue');
    expect(rowOf('Aortic valve')).toHaveTextContent(`Done ${shown(ago(5))}`);
    expect(screen.getByText(/done once Procedures and Outcomes records the same procedure/)).toBeInTheDocument();
  });

  it('opens Procedures and Outcomes from Record procedure', async () => {
    serve([consultation(ago(10), [recommends(SURGERY, MITRAL_VALVE, ELECTIVE)])]);

    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: /Record procedure/ }));
    expect(open).toHaveBeenCalledWith(config.procedures.form);
  });

  it('offers no Record procedure to a user who may not record it', async () => {
    vi.mocked(useMayEnterForm).mockReturnValue(false);
    serve([consultation(ago(10), [recommends(SURGERY, MITRAL_VALVE, ELECTIVE)])]);

    renderCard();

    expect(await screen.findByTestId('procedural-recommendation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record procedure/ })).not.toBeInTheDocument();
  });

  it('offers no Record procedure, and no note, once every recommendation is done', async () => {
    serve([consultation(ago(10), [recommends(SURGERY, MITRAL_VALVE, ELECTIVE)])], [procedure(ago(3), MITRAL_VALVE)]);

    renderCard();

    expect(within(await screen.findByTestId('procedural-recommendation')).getByText(/Done/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record procedure/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/done once Procedures and Outcomes/)).not.toBeInTheDocument();
  });

  it('does not count a procedure recorded before the latest consultation', async () => {
    serve([consultation(ago(10), [recommends(SURGERY, MITRAL_VALVE, ELECTIVE)])], [procedure(ago(20), MITRAL_VALVE)]);

    renderCard();

    expect(await screen.findByTestId('procedural-recommendation')).toHaveTextContent('Waiting');
  });

  it('shows nothing when the latest consultation recommends no procedure', async () => {
    serve([
      consultation(ago(10), [recommends(coded(NONE, 'None'), null, null)]),
      consultation(ago(40), [recommends(SURGERY, MITRAL_VALVE, ELECTIVE)]),
    ]);

    const { container } = renderCard();

    await waitFor(() => expect(vi.mocked(openmrsFetch)).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
