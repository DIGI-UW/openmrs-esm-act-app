import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type AssignedExtension,
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  openmrsFetch,
  useAssignedExtensions,
} from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import CliniciansOnlyNote from '../chart-note/clinicians-only-note.component';
import ClinicsBanner from '../contact/clinics-banner.component';
import InrCard from '../inr/inr-card.component';
import InrDashboardLink, { patientOfBasePath } from '../inr/inr-dashboard-link.component';
import InrReviews from '../inr/inr-reviews.component';
import { launchInInrWindow } from '../inr/launch-inr-window';
import { inrResult, targetRange, toInrReviews } from '../inr/inr.resource';
import { InrPill } from '../patient-status/status-pills.component';
import ConsultationCard from './consultation-card.component';
import Consultations from './consultations.component';
import { type ChartEncounter, toConsultation } from './consultations.resource';
import { warfarinOf } from '../medications/medications.resource';
import { diagnosisConcepts } from './patient-details.resource';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';

// The INR card draws its trend with the chart library, whose SVG calls happy-dom does not implement.
vi.mock('@carbon/charts-react', async () => ({
  ...(await vi.importActual<object>('@carbon/charts-react')),
  AreaChart: () => <div data-testid="area-chart" />,
}));

// Opening a form in a visit is open-form-in-visit's own test; here it records which form was opened.
const openForm = vi.fn();
vi.mock('../visits/open-form-in-visit', () => ({
  useOpenFormInVisit: vi.fn(() => ({ open: openForm, isOpening: false })),
}));

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: ({ basePath, path, title }: { basePath: string; path: string; title: string }) => (
    <a href={`${basePath}/${path}`}>{title}</a>
  ),
  // The framework's test mock has no getAssignedExtensions, which reads a dashboard group's slot.
  getAssignedExtensions: vi.fn(() => []),
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const i = config.inrReviews.concepts;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});

const consultation = (uuid: string, date: string, extra: Array<unknown> = []): ChartEncounter =>
  ({
    uuid,
    encounterDatetime: `${date}T09:00:00.000+0300`,
    encounterProviders: [{ provider: { display: 'drsarah - Sarah Namusoke' } }],
    obs: [
      obs(c.nyha, coded('nyha2', 'NYHA Class II')),
      obs(c.prophylaxis, null, [obs(c.prophylaxis, coded('q28', 'Q28 day BPG'))]),
      obs(c.nextAmount, 6),
      obs(c.nextPeriod, coded('1074AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Months')),
      ...extra,
    ],
  }) as ChartEncounter;

const warfarinGroup = (stopped = false) =>
  obs(c.medication, null, [
    obs(c.medication, coded(config.consultations.vitaminKAntagonists[0], 'Warfarin')),
    obs(c.medicationDose, '5 mg daily'),
    ...(stopped ? [obs(c.dateStopped, '2026-09-01')] : []),
  ]);

const medicationUpdate = (uuid: string, date: string, extra: Array<unknown>): ChartEncounter =>
  ({ uuid, encounterDatetime: `${date}T09:00:00.000+0300`, obs: extra }) as ChartEncounter;

const inrEncounter = (uuid: string, tested: string, value: number, next: string): ChartEncounter =>
  ({
    uuid,
    encounterDatetime: `${tested}T09:00:00.000+0300`,
    obs: [
      obs(i.target, coded('t23', '2.0 - 3.0')),
      {
        uuid: `${uuid}-group`,
        ...obs(i.group, null, [obs(i.dateTested, `${tested}T00:00:00.000+0300`), obs(i.value, value)]),
      },
      obs(i.nextInr, `${next}T00:00:00.000+0300`),
    ],
  }) as ChartEncounter;

/** The server: these consultations, INR monitorings and person, and forms the user may enter when `mayEnter`. */
function serve({
  consultations = [] as Array<ChartEncounter>,
  inr = [] as Array<ChartEncounter>,
  updates = [] as Array<ChartEncounter>,
  patientInformation = [] as Array<ChartEncounter>,
  mayEnter = true,
}: {
  consultations?: Array<ChartEncounter>;
  inr?: Array<ChartEncounter>;
  updates?: Array<ChartEncounter>;
  patientInformation?: Array<ChartEncounter>;
  mayEnter?: boolean;
} = {}) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
    if (url.includes(`encounterType=${config.consultations.encounterType}`)) {
      return { data: { results: consultations, totalCount: consultations.length } };
    }
    if (url.includes(`encounterType=${config.inrReviews.encounterType}`)) {
      return { data: { results: inr, totalCount: inr.length } };
    }
    if (url.includes(`encounterType=${config.medications.encounterType}`)) {
      return { data: { results: updates, totalCount: updates.length } };
    }
    if (url.includes(`encounterType=${diagnosisConcepts.encounterTypes.patientInformation}`)) {
      return { data: { results: patientInformation, totalCount: patientInformation.length } };
    }
    if (url.includes('encounterType=')) {
      return { data: { results: [], totalCount: 0 } };
    }
    if (url.includes('/person/')) {
      return {
        data: {
          attributes: [
            { attributeType: { uuid: config.contactCard.attributeTypes.phone }, value: '+256772000101' },
            {
              attributeType: { uuid: config.contactCard.attributeTypes.cardiacClinic },
              value: coded('gulu', 'Gulu RRH'),
            },
          ],
          preferredAddress: { cityVillage: 'Laroo' },
        },
      };
    }
    if (url.includes('/actcore/cardiology')) {
      return { data: { nextDue: '2026-01-10' } };
    }
    if (url.includes('/form/')) {
      return {
        data: { uuid: 'form', encounterType: { editPrivilege: mayEnter ? null : { display: 'Task: nobody' } } },
      };
    }
    return { data: {} };
  }) as never);
}

const renderIn = (element: React.ReactElement) =>
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{element}</SWRConfig>);

const showReadings = async () => userEvent.click(await screen.findByRole('button', { name: /Show readings/ }));

describe('chart pages by role', () => {
  beforeEach(async () => {
    await signInWith([
      'Add Encounters',
      'Edit Encounters',
      'Get Encounters',
      'Get Observations',
      'Task: act.enterClinicalForms',
    ]);
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    vi.mocked(useAssignedExtensions).mockReturnValue([]);
  });

  it("reads a consultation's provider, NYHA class, prophylaxis plan and next review", () => {
    const visit = toConsultation(
      consultation('c1', '2026-04-01', [
        obs(c.prophylaxis, null, [
          obs(c.prophylaxis, coded('oral', 'Oral penicillin V')),
          obs(c.dateStopped, '2026-05-01'),
        ]),
      ]),
      c,
    );
    expect(visit).toMatchObject({
      seenBy: 'Sarah Namusoke',
      nyha: 'NYHA Class II',
      plan: 'Q28 day BPG; Oral penicillin V (stopped)',
    });
    expect(visit.nextReview.getMonth()).toBe(9);
  });

  it('reads warfarin from the latest consultation that answers Cardiac Medication, and its dose', () => {
    const vkas = config.consultations.vitaminKAntagonists;
    expect(warfarinOf([consultation('new', '2026-09-01', [warfarinGroup()])], c, vkas)).toEqual({ dose: '5 mg daily' });
    expect(warfarinOf([consultation('new', '2026-09-01', [warfarinGroup(true)])], c, vkas)).toBeNull();
    // A later consultation that records no medicine leaves the earlier answer in force.
    expect(
      warfarinOf([consultation('later', '2026-10-01'), consultation('old', '2026-09-01', [warfarinGroup()])], c, vkas),
    ).not.toBeNull();
  });

  it('reads warfarin from the Medication Update records too, the latest record of the medicine deciding', () => {
    const vkas = config.consultations.vitaminKAntagonists;
    const added = medicationUpdate('update', '2026-09-01', [warfarinGroup()]);
    expect(warfarinOf([added], c, vkas)).toEqual({ dose: '5 mg daily' });
    expect(warfarinOf([consultation('visit', '2026-10-01'), added], c, vkas)).toEqual({ dose: '5 mg daily' });
    const stopped = medicationUpdate('stop', '2026-10-01', [warfarinGroup(true)]);
    expect(warfarinOf([stopped, added], c, vkas)).toBeNull();
  });

  it('keeps warfarin active when a later record lists only another medicine', () => {
    const vkas = config.consultations.vitaminKAntagonists;
    const aspirin = obs(c.medication, null, [obs(c.medication, coded('aspirin', 'Aspirin'))]);
    const added = medicationUpdate('update', '2026-09-01', [warfarinGroup()]);
    expect(warfarinOf([consultation('later', '2026-10-01', [aspirin]), added], c, vkas)).toEqual({
      dose: '5 mg daily',
    });
  });

  it('keeps the dose when a later record of warfarin gives none, and stops it when that record has a Date Stopped', () => {
    const vkas = config.consultations.vitaminKAntagonists;
    const added = medicationUpdate('update', '2026-09-01', [warfarinGroup()]);
    const noDose = (extra: Array<unknown> = []) =>
      obs(c.medication, null, [obs(c.medication, coded(vkas[0], 'Warfarin')), ...extra]);
    expect(warfarinOf([medicationUpdate('later', '2026-10-01', [noDose()]), added], c, vkas)).toEqual({
      dose: '5 mg daily',
    });
    expect(
      warfarinOf(
        [medicationUpdate('later', '2026-10-01', [noDose([obs(c.dateStopped, '2026-10-01')])]), added],
        c,
        vkas,
      ),
    ).toBeNull();
  });

  it('is on warfarin while any vitamin K antagonist is active, with that medicine dose', () => {
    const vkas = config.consultations.vitaminKAntagonists;
    const acitrom = obs(c.medication, null, [
      obs(c.medication, coded(vkas[1], 'Acitrom')),
      obs(c.medicationDose, '3 mg daily'),
    ]);
    const stoppedWarfarin = medicationUpdate('stop', '2026-10-01', [warfarinGroup(true)]);
    const switched = medicationUpdate('switch', '2026-10-02', [acitrom]);
    expect(
      warfarinOf([stoppedWarfarin, medicationUpdate('start', '2026-09-01', [warfarinGroup()])], c, vkas),
    ).toBeNull();
    expect(
      warfarinOf([switched, stoppedWarfarin, medicationUpdate('start', '2026-09-01', [warfarinGroup()])], c, vkas),
    ).toEqual({ dose: '3 mg daily' });
  });

  it('judges each INR against its target range', () => {
    expect(targetRange('2.0 - 3.0')).toEqual([2, 3]);
    expect(targetRange('2.5-3.5')).toEqual([2.5, 3.5]);
    expect([
      inrResult(1.6, '2.0 - 3.0'),
      inrResult(2.4, '2.0 - 3.0'),
      inrResult(3.6, '2.5-3.5'),
      inrResult(null, '2.0 - 3.0'),
    ]).toEqual(['below', 'inRange', 'above', 'unknown']);
    const reviews = toInrReviews(
      [inrEncounter('a', '2026-07-27', 1.6, '2026-08-24'), inrEncounter('b', '2026-08-24', 2.1, '2026-09-21')],
      i,
    );
    expect(reviews.map((review) => [review.inr, review.result])).toEqual([
      [2.1, 'inRange'],
      [1.6, 'below'],
    ]);
  });

  it('lists the consultations, newest first, with Start consultation for a user who may record one', async () => {
    serve({ consultations: [consultation('old', '2025-09-02'), consultation('new', '2026-04-01')] });

    renderIn(<Consultations patientUuid="winnie" />);

    const rows = await screen.findAllByTestId('consultation-row');
    expect(rows[0]).toHaveTextContent(/Apr.*2026.*Sarah Namusoke.*NYHA Class II.*Q28 day BPG/);
    expect(await screen.findByRole('button', { name: /Start consultation/ })).toBeInTheDocument();
  });

  it('reopens a consultation in its form from its Edit', async () => {
    serve({ consultations: [consultation('old', '2025-09-02'), consultation('new', '2026-04-01')] });

    renderIn(<Consultations patientUuid="winnie" />);

    await userEvent.click(await screen.findByRole('button', { name: /^Edit consultation of .*2026/ }));
    expect(openForm).toHaveBeenCalledWith(config.consultations.form, undefined, 'new');
  });

  it('shows the consultations read-only to a user who may not record one', async () => {
    serve({ consultations: [consultation('new', '2026-04-01')], mayEnter: false });

    renderIn(<Consultations patientUuid="winnie" />);

    expect(await screen.findAllByTestId('consultation-row')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Start consultation|^Edit/ })).not.toBeInTheDocument();
  });

  it('summarises the last consultation, the overdue review in red, and the cardiac clinic', async () => {
    serve({ consultations: [consultation('new', '2026-04-01')] });

    renderIn(<ConsultationCard patientUuid="winnie" />);

    expect(await screen.findByTestId('consultation-cardiac-clinic')).toHaveTextContent('Gulu RRH');
    expect(screen.getByTestId('consultation-last')).toHaveTextContent(/Apr.*2026/);
    expect(screen.getByTestId('consultation-next')).toHaveAttribute('data-overdue', 'true');
  });

  it('links Details to the Consultation visits page, for a user who may not record one too', async () => {
    const pageLink = { name: 'act-consultations-dashboard-link', meta: { path: 'act-consultations' }, config: {} };
    vi.mocked(useAssignedExtensions).mockReturnValue([pageLink] as unknown as Array<AssignedExtension>);
    for (const mayEnter of [true, false]) {
      serve({ consultations: [consultation('new', '2026-04-01')], mayEnter });
      const { unmount } = renderIn(<ConsultationCard patientUuid="winnie" />);

      expect(await screen.findByRole('link', { name: 'Details' })).toHaveAttribute(
        'href',
        '/openmrs/spa/patient/winnie/chart/act-consultations',
      );
      unmount();
    }
  });

  it('offers no Details when the chart has no Consultation visits page', async () => {
    vi.mocked(useAssignedExtensions).mockReturnValue([]);
    serve({ consultations: [consultation('new', '2026-04-01')] });

    renderIn(<ConsultationCard patientUuid="winnie" />);

    await screen.findByTestId('consultation-cardiac-clinic');
    expect(screen.queryByRole('link', { name: 'Details' })).not.toBeInTheDocument();
  });

  it('reopens the last consultation from Edit under it, and offers no Edit to a user who may not record one', async () => {
    serve({ consultations: [consultation('old', '2025-09-02'), consultation('new', '2026-04-01')] });
    const { unmount } = renderIn(<ConsultationCard patientUuid="winnie" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit last consultation' }));
    expect(openForm).toHaveBeenCalledWith(config.consultations.form, undefined, 'new');
    unmount();

    serve({ consultations: [consultation('new', '2026-04-01')], mayEnter: false });
    renderIn(<ConsultationCard patientUuid="winnie" />);
    await screen.findByTestId('consultation-cardiac-clinic');
    expect(screen.queryByRole('button', { name: 'Edit last consultation' })).not.toBeInTheDocument();
  });

  it('shows the diagnosis, from a Patient Information too, with Update diagnosis, which edits the last consultation', async () => {
    serve({
      consultations: [consultation('new', '2026-04-01')],
      patientInformation: [
        {
          uuid: 'pi',
          encounterDatetime: '2026-03-01T09:00:00.000+0300',
          obs: [
            obs(diagnosisConcepts.group, null, [
              obs(diagnosisConcepts.category, coded('rhd', 'Rheumatic Heart Disease/Rheumatic Fever')),
              obs(diagnosisConcepts.details[0], coded('rhdb', 'RHD B')),
            ]),
          ],
        } as ChartEncounter,
      ],
    });

    renderIn(<ConsultationCard patientUuid="winnie" />);

    expect(await screen.findByTestId('consultation-diagnosis')).toHaveTextContent(
      'Rheumatic Heart Disease/Rheumatic Fever (RHD B)',
    );
    await userEvent.click(await screen.findByRole('button', { name: /Update diagnosis/ }));
    expect(openForm).toHaveBeenCalledWith(config.consultations.form, undefined, 'new');
    expect(useOpenFormInVisit).toHaveBeenCalledWith('winnie');
  });

  it('offers Record diagnosis when there is none, which starts a consultation, and nothing to a user who may not record one', async () => {
    serve();
    const { unmount } = renderIn(<ConsultationCard patientUuid="winnie" />);
    await userEvent.click(await screen.findByRole('button', { name: /Record diagnosis/ }));
    expect(openForm).toHaveBeenCalledWith(config.consultations.form);
    unmount();

    serve({ consultations: [consultation('new', '2026-04-01')], mayEnter: false });
    renderIn(<ConsultationCard patientUuid="winnie" />);
    await screen.findByTestId('consultation-diagnosis');
    expect(screen.queryByRole('button', { name: /diagnosis/ })).not.toBeInTheDocument();
  });

  it('draws no chart on the INR reviews page when no review has a value', async () => {
    const missed = inrEncounter('a', '2026-07-27', 0, '2026-08-24');
    missed.obs = missed.obs.map((o) => (o.groupMembers ? { ...o, groupMembers: [o.groupMembers[0]] } : o));
    serve({ consultations: [consultation('new', '2026-04-01', [warfarinGroup()])], inr: [missed] });

    renderIn(<InrReviews patientUuid="winnie" />);

    expect((await screen.findAllByTestId('inr-row'))[0]).toHaveTextContent('--');
    expect(screen.queryByRole('img', { name: /INR over time/ })).not.toBeInTheDocument();
  });

  it('shows INR reviews, the INR card and the nav link only for a patient on warfarin', async () => {
    serve({
      consultations: [consultation('new', '2026-04-01', [warfarinGroup()])],
      inr: [inrEncounter('a', '2026-07-27', 1.6, '2026-08-24'), inrEncounter('b', '2026-08-24', 2.1, '2026-09-21')],
    });

    renderIn(
      <>
        <InrReviews patientUuid="winnie" />
        <InrCard patientUuid="winnie" />
        <InrDashboardLink basePath="/openmrs/spa/patient/winnie/chart" />
      </>,
    );

    expect((await screen.findAllByTestId('inr-row'))[0]).toHaveTextContent(/2\.1.*2\.0 - 3\.0.*In range/);
    expect(await screen.findByTestId('inr-dose')).toHaveTextContent('5 mg daily');
    expect(screen.getByTestId('inr-next')).toHaveAttribute('data-overdue', 'true');
    expect(await screen.findAllByRole('img', { name: /INR over time/ })).toHaveLength(1);
    await showReadings();
    expect(await screen.findAllByRole('img', { name: /INR over time/ })).toHaveLength(2);
    expect(screen.getByRole('link', { name: /INR reviews/ })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/winnie/chart/act-inr-reviews',
    );
  });

  it('treats a patient whose only warfarin is a Medication Update as on warfarin, with its dose', async () => {
    serve({
      updates: [medicationUpdate('update', '2026-09-01', [warfarinGroup()])],
      inr: [inrEncounter('a', '2026-07-27', 1.6, '2026-08-24')],
    });

    renderIn(
      <>
        <InrCard patientUuid="winnie" />
        <InrDashboardLink basePath="/openmrs/spa/patient/winnie/chart" />
      </>,
    );

    expect(await screen.findByTestId('inr-dose')).toHaveTextContent('5 mg daily');
    expect(await screen.findByRole('link', { name: /INR reviews/ })).toBeInTheDocument();
  });

  it("opens the INR editor from the card's reading and from a row of the INR reviews page, never the stock form", async () => {
    serve({
      consultations: [consultation('new', '2026-04-01', [warfarinGroup()])],
      inr: [inrEncounter('a', '2026-07-27', 1.6, '2026-08-24'), inrEncounter('b', '2026-08-24', 2.1, '2026-09-21')],
    });

    const { unmount } = renderIn(<InrReviews patientUuid="winnie" />);
    await userEvent.click(await screen.findByRole('button', { name: /^Edit INR of .*Jul/ }));
    expect(launchWorkspace2).toHaveBeenLastCalledWith('act-inr-edit-workspace', {
      encounterUuid: 'a',
      groupUuid: 'a-group',
    });
    unmount();

    renderIn(<InrCard patientUuid="winnie" />);
    await showReadings();
    await userEvent.click(await screen.findByRole('button', { name: /^Edit INR of .*Aug/ }));
    expect(launchWorkspace2).toHaveBeenLastCalledWith('act-inr-edit-workspace', {
      encounterUuid: 'b',
      groupUuid: 'b-group',
    });
    expect(openForm).not.toHaveBeenCalled();
  });

  it('records a new INR through the INR Monitoring form, launched in the INR window', async () => {
    serve({
      consultations: [consultation('new', '2026-04-01', [warfarinGroup()])],
      inr: [inrEncounter('a', '2026-08-24', 2.1, '2026-09-21')],
    });

    renderIn(<InrCard patientUuid="winnie" />);

    await userEvent.click(await screen.findByRole('button', { name: /Record INR/ }));
    expect(openForm).toHaveBeenCalledWith(config.inrReviews.form);
    expect(useOpenFormInVisit).toHaveBeenCalledWith('winnie', launchInInrWindow);
  });

  it('launches the form entry workspace of the INR window for a form the hook opens', () => {
    launchInInrWindow('patient-form-entry-workspace', { form: 'f', encounterUuid: '' });

    expect(launchWorkspace2).toHaveBeenCalledWith('act-inr-form-entry-workspace', { form: 'f', encounterUuid: '' });
  });

  it('offers Record INR but no Edit to a user without Edit Encounters', async () => {
    await signInWith(['Add Encounters', 'Get Encounters', 'Get Observations', 'Task: act.enterClinicalForms']);
    serve({
      consultations: [consultation('new', '2026-04-01', [warfarinGroup()])],
      inr: [inrEncounter('a', '2026-08-24', 2.1, '2026-09-21')],
    });

    renderIn(
      <>
        <InrReviews patientUuid="winnie" />
        <InrCard patientUuid="winnie" />
      </>,
    );

    await screen.findByTestId('inr-row');
    expect(await screen.findAllByRole('button', { name: /Record INR/ })).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it('offers no INR Edit to a user who may not record one', async () => {
    serve({
      consultations: [consultation('new', '2026-04-01', [warfarinGroup()])],
      inr: [inrEncounter('a', '2026-08-24', 2.1, '2026-09-21')],
      mayEnter: false,
    });

    renderIn(
      <>
        <InrReviews patientUuid="winnie" />
        <InrCard patientUuid="winnie" />
      </>,
    );

    await screen.findByTestId('inr-row');
    await showReadings();
    await screen.findAllByTestId('inr-reading');
    expect(screen.queryByRole('button', { name: /^Edit|Record INR/ })).not.toBeInTheDocument();
  });

  it('hides the INR card and nav link for a patient not on warfarin', async () => {
    serve({ consultations: [consultation('new', '2026-04-01')] });

    renderIn(
      <>
        <ClinicsBanner patientUuid="winnie" />
        <InrCard patientUuid="winnie" />
        <InrDashboardLink basePath="/openmrs/spa/patient/winnie/chart" />
      </>,
    );

    expect(await screen.findByTestId('banner-cardiac-clinic')).toHaveTextContent('Cardiac clinic: Gulu RRH');
    expect(screen.queryByTestId('inr-reading')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /INR reviews/ })).not.toBeInTheDocument();
    expect(patientOfBasePath('/openmrs/spa/patient/abc-123/chart')).toBe('abc-123');
  });

  it('shows the INR card for a patient with an INR who is not on warfarin', async () => {
    serve({
      consultations: [consultation('new', '2026-04-01')],
      inr: [inrEncounter('a', '2026-08-24', 2.1, '2026-09-21')],
    });

    renderIn(<InrCard patientUuid="winnie" />);

    await showReadings();
    expect(await screen.findByTestId('inr-reading')).toHaveTextContent(/2\.1 · in range/);
    expect(screen.getByRole('img', { name: /INR over time: 2\.1/ })).toBeInTheDocument();
  });

  it('shows the clinics registration recorded on the banner, leaving out one not recorded', async () => {
    serve();

    renderIn(<ClinicsBanner patientUuid="winnie" />);

    expect(await screen.findByTestId('banner-cardiac-clinic')).toHaveTextContent('Cardiac clinic: Gulu RRH');
    expect(screen.queryByTestId('banner-primary-care-clinic')).not.toBeInTheDocument();
  });

  it('tells a user who is not a clinician that the clinical pages are for clinicians, and says nothing to a clinician', async () => {
    const { unmount } = render(<CliniciansOnlyNote />);
    expect(screen.queryByTestId('clinicians-only-note')).not.toBeInTheDocument();
    unmount();

    await signInWith(['Get Patients']);
    render(<CliniciansOnlyNote />);
    expect(screen.getByTestId('clinicians-only-note')).toHaveTextContent(
      'Clinical dashboards are only visible to clinicians.',
    );
  });

  it('shows the INR pill when the next INR is overdue or within 48 hours, and not further ahead', () => {
    const inDays = (days: number) => new Date(Date.now() + days * 86400000);
    const { rerender } = render(<InrPill nextInr={inDays(-3)} />);
    expect(screen.getByTestId('inr-status')).toHaveTextContent('INR overdue');
    rerender(<InrPill nextInr={inDays(0)} />);
    expect(screen.getByTestId('inr-status')).toHaveTextContent('INR due today');
    rerender(<InrPill nextInr={inDays(10)} />);
    expect(screen.queryByTestId('inr-status')).not.toBeInTheDocument();
  });
});
