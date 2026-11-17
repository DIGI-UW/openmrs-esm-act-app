import { vi } from 'vitest';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { CLINICS_PROPERTY } from '../clinic-limit';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

export const CC = 'b9ab4b76-e7b9-46a7-b4ec-5b7fdd8fa540';
export const DC = '61e9bb28-11df-4df1-965d-11ef928d5239';
export const CL = '60625a0c-3cea-4fe5-b6ca-615c743ad9d4';
export const SA = 'a1295a20-7273-4339-b5df-2f8a3a841c77';
export const IA = '07a7affa-b7de-46d9-9faa-aac4ef2eccba';
export const roleNames: Record<string, string> = {
  [CC]: 'Organizational: ACT Community Clinician',
  [DC]: 'Organizational: ACT Data Clerk',
  [CL]: 'Organizational: ACT Clinician',
  [SA]: 'Organizational: ACT Site Administrator',
  [IA]: 'Organizational: ACT Instance Administrator',
};
export const clinics = [
  { uuid: 'acimi', display: 'Acimi HCIII' },
  { uuid: 'akuna', display: 'Akunalaber HCIII' },
];

export const user = (uuid: string, given: string, roles: Array<string>, clinicUuids: string, retired = false) => ({
  uuid,
  username: given.toLowerCase(),
  retired,
  userProperties: { [CLINICS_PROPERTY]: clinicUuids, defaultLocation: 'acimi' },
  person: {
    uuid: `${uuid}-person`,
    gender: 'F',
    preferredName: { uuid: `${uuid}-name`, givenName: given, familyName: 'Okot' },
  },
  roles: roles.map((role) => ({ uuid: role, display: roleNames[role] })),
});

export const users = [
  user('grace', 'Grace', [CC], 'acimi'),
  user('james', 'James', [CL], 'acimi,akuna'),
  user('ruth', 'Ruth', [DC], 'akuna', true),
];

type Call = { url: string; method: string; body: unknown };

/** The server: users, roles and clinics; every write recorded, and `fails` the error each write answers with. */
export function backend(fails?: string) {
  const writes: Array<Call> = [];
  mockOpenmrsFetch.mockImplementation((async (url: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({ url, method, body: init?.body });
      if (fails) {
        throw Object.assign(new Error('403'), { responseBody: { error: { message: fails } } });
      }
      return { data: url.endsWith('/user') ? { uuid: 'new-user', person: { uuid: 'new-person' } } : {} };
    }
    const role = /\/role\/([^?]+)/.exec(url)?.[1];
    if (role) {
      return { data: { uuid: role, display: roleNames[role] } };
    }
    if (url.includes('/location?tag=')) {
      return { data: { results: clinics, totalCount: clinics.length } };
    }
    if (/\/location\/acimi\?/.test(url)) {
      return { data: { display: 'Acimi HCIII' } };
    }
    if (url.includes('/user?')) {
      return { data: { results: users, totalCount: users.length } };
    }
    return { data: { results: [] } };
  }) as never);
  return writes;
}

/** Signs in with a role and the privileges a user administrator holds; a site administrator's account names Acimi. */
export async function signInAs(role: string, extra: Array<string> = []) {
  await signInWith(['Edit Users', 'Add Users', 'Edit User Passwords', ...extra]);
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    user: {
      ...session.user,
      uuid: 'me',
      roles: [{ uuid: role, display: roleNames[role] }],
      userProperties: { [CLINICS_PROPERTY]: 'acimi' },
    },
  } as never);
}
