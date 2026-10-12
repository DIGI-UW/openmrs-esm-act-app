import { vi } from 'vitest';
import { openmrsFetch } from '@openmrs/esm-framework';

// Shaped as the distro's REST answers encounter searches with groupMembers: dates as days, coded answers as {uuid, display}.
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers: Array<object> | null = null) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});

export const concepts = {
  date: 'c3edefd2-5777-5084-b01e-fd4ca0e40162',
  nyha: '2f51b894-383c-53bb-9997-583e9761d132',
  prophylaxis: '668e0221-8b41-5669-9ad8-78e193d42494',
  medication: '0734567e-4f0a-5090-9d74-b953921a30e6',
  dosing: '8879385e-d35e-50a3-a3d0-4333d95d4878',
  started: '5bcc7d12-b279-5955-815c-090a1f392071',
  stopped: 'd75edc42-3213-5a06-9228-4e5735b9594b',
  amount: 'ba4b8a87-2ce8-559e-9a30-45504a9b6c1f',
  period: '1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  inrTarget: '0778ce12-ddba-5e22-b5fd-92424e8747b4',
  dateTested: 'be9041b1-3948-5de0-a8b1-974e84b95715',
  inr: '161482AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  newDose: 'f27f6ed2-48db-5be7-91da-3e2483915462',
  nextInr: '5096AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  indication: '6e8ed53f-15e6-5b00-9ed0-44b11bd2d638',
};

export const encounterTypes = {
  consultation: 'c2503561-c00d-5460-8157-43d594472b4a',
  inr: 'b4bb88a3-9a04-5142-85bd-bb63c270f632',
  patientInformation: 'ffdc883f-f99f-496a-83f9-2c3c581e1af0',
};

export const forms = {
  consultation: '4b063fc7-996f-3001-8500-8940e201be8f',
  inr: 'fe4848b2-a0b4-329f-a6a3-6ffc298e09a9',
};

const warfarin = coded('5e97fe35-58df-4925-bba7-7c49d75268a1', 'Warfarin');
const months = coded('1074AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Months');

export const medication = (drug: { uuid: string; display: string }, extra: Array<object> = []) =>
  obs(concepts.medication, null, [obs(concepts.medication, drug), obs(concepts.started, '2026-08-08'), ...extra]);

/** Winnie Auma's two consultations on the seeded distro, with a provider, NYHA class and next review added. */
export const consultations = [
  {
    uuid: 'first',
    encounterDatetime: '2025-10-14T12:00:00.000+0000',
    encounterProviders: [],
    obs: [
      obs(concepts.date, '2025-10-14'),
      obs(concepts.prophylaxis, null, [
        obs(concepts.started, '2025-10-14'),
        obs(concepts.prophylaxis, coded('50be4b26-6c5b-5aaa-9254-3bfd313b4522', 'Q28 day BPG')),
      ]),
      obs(concepts.amount, 6),
      obs(concepts.period, months),
    ],
  },
  {
    uuid: 'second',
    encounterDatetime: '2026-08-08T06:00:00.000+0000',
    encounterProviders: [
      {
        provider: {
          display: 'communityClinician-provider - ACT Community Clinician',
          name: null,
          person: { display: 'ACT Community Clinician' },
        },
      },
    ],
    obs: [
      obs(concepts.date, '2026-08-08'),
      obs(concepts.nyha, coded('e4a2da4b-cca3-5bd6-bfc6-8e206dc339e9', 'II')),
      medication(warfarin, [obs(concepts.dosing, '5 mg daily')]),
    ],
  },
];

/** An INR review as the form saves it: the target and each reading's group share the INR Target question, the target top level. */
export const inrReview = {
  uuid: 'review',
  encounterDatetime: '2026-09-01T10:00:00.000+0000',
  obs: [
    obs(concepts.indication, coded('6f68aab6-4053-5476-9e12-b53b8709d87f', 'Mechanical Valve')),
    // A reading's group may come before the target: only its members tell them apart.
    obs(concepts.inrTarget, null, [obs(concepts.dateTested, '2026-08-20'), obs(concepts.inr, 1.8)]),
    obs(concepts.inrTarget, coded('d894d89a-04bd-5fc0-91a0-5dc3ddd8802b', '2.0-3.0')),
    obs(concepts.inrTarget, null, [
      obs(concepts.dateTested, '2026-09-01'),
      obs(concepts.inr, 3.4),
      obs(concepts.newDose, '4 mg daily'),
    ]),
    obs(concepts.nextInr, '2026-10-01'),
  ],
};

/** Lillian Aber's INR review on the distro: the target is a member of the reading's group, as the INR Monitoring report reads it. */
export const inrReviewTargetInGroup = {
  uuid: 'target-in-group',
  encounterDatetime: '2026-09-04T11:00:00.000+0000',
  obs: [
    obs(concepts.nextInr, '2026-10-04'),
    obs(concepts.inrTarget, null, [
      obs(concepts.inrTarget, coded('ea841a3a-f9cb-5761-aac6-939ffb158d94', '2.5-3.5')),
      obs(concepts.inr, 2.8),
      obs(concepts.dateTested, '2026-09-04'),
    ]),
    obs(concepts.indication, coded('6f68aab6-4053-5476-9e12-b53b8709d87f', 'Mechanical Valve')),
  ],
};

/** Winnie's only INR review on the seeded distro: an indication and nothing else. */
export const indicationOnly = {
  uuid: 'indication-only',
  encounterDatetime: '2026-08-30T11:00:00.000+0000',
  obs: [obs(concepts.indication, coded('6f68aab6-4053-5476-9e12-b53b8709d87f', 'Mechanical Valve'))],
};

/** Answers each encounter search by its encounter type, every other URL by the given handler, else with nothing. */
export function respondWithEncounters(
  byType: Partial<Record<keyof typeof encounterTypes, Array<object>>>,
  other: (url: string) => unknown = () => ({ results: [] }),
) {
  vi.mocked(openmrsFetch).mockImplementation(((url: string) => {
    const type = (Object.keys(encounterTypes) as Array<keyof typeof encounterTypes>).find((key) =>
      url.includes(`encounterType=${encounterTypes[key]}`),
    );
    const results = type ? (byType[type] ?? []) : null;
    const data = results ? { results, totalCount: results.length } : other(url);
    return data instanceof Error ? Promise.reject(data) : Promise.resolve({ data });
  }) as never);
}
